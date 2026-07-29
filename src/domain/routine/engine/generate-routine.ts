import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { hasTextMatch, normalizeMuscle } from "../../exercises/normalization";
import { RoutineRequestSchema, type RoutineRequest } from "../../profile/routine-request";
import { evaluateRoutineSafety } from "../../safety/evaluate-safety";
import { SafetyScreeningSchema, type SafetyAssessment, type SafetyScreening } from "../../safety/schemas";
import { exerciseCountForSession, SESSION_TIME_RULES } from "../config/session-time";
import type { SplitDayTemplate, SplitTemplate } from "../config/split-templates";
import { WEEKLY_VOLUME_RULES } from "../config/volume-rules";
import { RoutinePlanSchema, type RoutineDay, type RoutineExercise, type RoutinePlan } from "../schemas";
import { validateRoutine, type RoutineValidationResult } from "../validators/validate-routine";
import { assignPrescription } from "./assign-prescription";
import { buildCandidatePool } from "./build-candidate-pool";
import { calculateWeeklyVolume } from "./calculate-weekly-volume";
import { chooseSplit } from "./choose-split";
import { estimateSessionDuration } from "./estimate-session-duration";
import { deterministicId, generatedAtFromSeed } from "./seed";
import { selectExercises } from "./select-exercises";
import { selectionReasons } from "./score-exercise";

export const ENGINE_VERSION = "1.0.0";

export type GenerateRoutineInput = {
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
  datasetVersion: string;
  seed: string;
  engineVersion?: string;
};

export type RoutineGenerationFailure = {
  ok: false;
  code: "INVALID_INPUT" | "SAFETY_BLOCKED" | "INSUFFICIENT_CATALOG" | "VALIDATION_FAILED";
  message: string;
  safety?: SafetyAssessment;
  validation?: RoutineValidationResult;
};

export type RoutineGenerationSuccess = {
  ok: true;
  plan: RoutinePlan;
  validation: RoutineValidationResult;
  safety: SafetyAssessment;
};

export type RoutineGenerationResult = RoutineGenerationSuccess | RoutineGenerationFailure;

function priorityMuscleMatch(
  exercise: CatalogExercise,
  request: RoutineRequest,
): boolean {
  const requested = new Set(request.focusMuscles.map(normalizeMuscle));
  return exercise.primaryMuscles.map(normalizeMuscle).some((muscle) => requested.has(muscle));
}

function buildPrescribedExercises(
  selected: readonly CatalogExercise[],
  request: RoutineRequest,
  day: SplitDayTemplate,
): RoutineExercise[] {
  return selected.map((exercise, index) => {
    const desiredPattern = day.patternSequence[index % day.patternSequence.length];
    const prescription = assignPrescription(exercise, request, {
      // A requested focus can land in a later isolation slot (for example
      // biceps in a limbs day). Treat that direct focus movement as primary
      // for prescription purposes so advanced plans still reach their
      // minimum direct focus volume without relying on duplicate exercises.
      isPrimaryForDay: index < 2 || priorityMuscleMatch(exercise, request),
      isPriorityMuscle: priorityMuscleMatch(exercise, request),
    });
    return {
      exerciseId: exercise.id,
      ...prescription,
      selectionReasons: selectionReasons(exercise, {
        request,
        day,
        desiredPattern,
        selectionIndex: index,
        seed: "reasons",
      }),
    };
  });
}

function fitSessionDuration(
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[],
  sessionMinutes: number,
): RoutineExercise[] {
  let fitted = exercises.map((exercise) => ({ ...exercise }));
  const upperBound = sessionMinutes + SESSION_TIME_RULES.upperToleranceMinutes;

  while (
    fitted.length > SESSION_TIME_RULES.minimumExerciseCount &&
    estimateSessionDuration(fitted, catalog) > upperBound
  ) {
    fitted = fitted.slice(0, -1);
  }

  let reductionCursor = fitted.length - 1;
  while (estimateSessionDuration(fitted, catalog) > upperBound && reductionCursor >= 0) {
    const current = fitted[reductionCursor];
    if (current && current.sets > 2) {
      fitted[reductionCursor] = { ...current, sets: current.sets - 1 };
    } else {
      reductionCursor -= 1;
    }
  }

  return fitted;
}

export type BuildRoutineDayInput = {
  request: RoutineRequest;
  dayTemplate: SplitDayTemplate;
  dayIndex: number;
  candidatePool: readonly CatalogExercise[];
  catalog: readonly CatalogExercise[];
  seed: string;
  usedExerciseIds: ReadonlySet<string>;
  planIdentity: string;
};

export function buildRoutineDay(input: BuildRoutineDayInput): RoutineDay | null {
  const count = exerciseCountForSession(
    input.request.sessionMinutes,
    input.request.goal,
  );
  const selected = selectExercises(input.candidatePool, {
    request: input.request,
    day: input.dayTemplate,
    count,
    seed: `${input.seed}:day:${input.dayIndex}`,
    usedExerciseIds: input.usedExerciseIds,
  });
  if (selected.length < SESSION_TIME_RULES.minimumExerciseCount) {
    return null;
  }

  const exercises = fitSessionDuration(
    buildPrescribedExercises(selected, input.request, input.dayTemplate),
    input.catalog,
    input.request.sessionMinutes,
  );
  const estimatedMinutes = estimateSessionDuration(exercises, input.catalog);
  return {
    id: deterministicId("day", `${input.planIdentity}:${input.dayTemplate.key}:${input.dayIndex}`),
    name: input.dayTemplate.name,
    focus: [...input.dayTemplate.focus],
    estimatedMinutes,
    exercises,
  };
}

function titleForGoal(request: RoutineRequest): string {
  const goalLabels: Readonly<Record<RoutineRequest["goal"], string>> = {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Acondicionamiento general",
    muscular_endurance: "Resistencia muscular",
  };
  return `${goalLabels[request.goal]} · ${request.daysPerWeek} ${request.daysPerWeek === 1 ? "día" : "días"}`;
}

/**
 * Deterministic correction pass for volume overflow. It reduces the lowest
 * priority eligible set one at a time, then recomputes the affected session.
 */
export function correctWeeklyVolume(
  plan: RoutinePlan,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  options: { mutableDayIndexes?: ReadonlySet<number> } = {},
): RoutinePlan {
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const priorityMuscles = new Set(request.focusMuscles.map(normalizeMuscle));
  const maximumSets = WEEKLY_VOLUME_RULES[request.goal][request.experience].maximumSets;
  let corrected = plan;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const volume = calculateWeeklyVolume(corrected, catalog);
    const offender = Object.entries(volume)
      .filter(([, values]) => values.totalSets > maximumSets)
      .sort(
        ([leftMuscle, left], [rightMuscle, right]) =>
          right.totalSets - maximumSets - (left.totalSets - maximumSets) ||
          leftMuscle.localeCompare(rightMuscle, "en"),
      )[0];
    if (!offender) {
      break;
    }

    const [offendingMuscle] = offender;
    const candidates = corrected.days.flatMap((day, dayIndex) => {
      if (options.mutableDayIndexes && !options.mutableDayIndexes.has(dayIndex)) {
        return [];
      }
      return day.exercises.flatMap((prescribed, exerciseIndex) => {
        const exercise = catalogById.get(prescribed.exerciseId);
        const minimumCorrectedSets = exercise?.modality === "isolation" ? 1 : 2;
        if (!exercise || prescribed.sets <= minimumCorrectedSets) {
          return [];
        }
        const direct = exercise.primaryMuscles
          .map(normalizeMuscle)
          .includes(offendingMuscle);
        const indirect = exercise.secondaryMuscles
          .map(normalizeMuscle)
          .includes(offendingMuscle);
        if (!direct && !indirect) {
          return [];
        }
        return [
          {
            dayIndex,
            exerciseIndex,
            direct,
            modality: exercise.modality,
          },
        ];
      });
    });
    const candidate = candidates.sort(
      (left, right) =>
        Number(right.direct) - Number(left.direct) ||
        Number(right.modality === "isolation") - Number(left.modality === "isolation") ||
        right.exerciseIndex - left.exerciseIndex ||
        right.dayIndex - left.dayIndex,
    )[0];
    if (candidate) {
      corrected = {
        ...corrected,
        days: corrected.days.map((day, dayIndex) => {
          if (dayIndex !== candidate.dayIndex) {
            return day;
          }
          const exercises = day.exercises.map((exercise, exerciseIndex) =>
            exerciseIndex === candidate.exerciseIndex
              ? { ...exercise, sets: exercise.sets - 1 }
              : exercise,
          );
          return {
            ...day,
            exercises,
            estimatedMinutes: estimateSessionDuration(exercises, catalog),
          };
        }),
      };
      continue;
    }

    const removal = corrected.days
      .flatMap((day, dayIndex) => {
        if (
          (options.mutableDayIndexes && !options.mutableDayIndexes.has(dayIndex)) ||
          day.exercises.length <= SESSION_TIME_RULES.minimumExerciseCount
        ) {
          return [];
        }
        return day.exercises.flatMap((prescribed, exerciseIndex) => {
          const exercise = catalogById.get(prescribed.exerciseId);
          if (!exercise) return [];
          const direct = exercise.primaryMuscles
            .map(normalizeMuscle)
            .includes(offendingMuscle);
          const indirect = exercise.secondaryMuscles
            .map(normalizeMuscle)
            .includes(offendingMuscle);
          if (!direct && !indirect) return [];
          const protectedByRequest =
            exercise.primaryMuscles
              .map(normalizeMuscle)
              .some((muscle) => priorityMuscles.has(muscle)) ||
            request.preferredExercises.includes(exercise.id) ||
            hasTextMatch(
              [exercise.name, exercise.sourceName ?? "", ...exercise.aliases],
              request.preferredExercises,
            );
          return [
            {
              dayIndex,
              exerciseIndex,
              direct,
              modality: exercise.modality,
              protectedByRequest,
            },
          ];
        });
      })
      .sort(
        (left, right) =>
          Number(left.protectedByRequest) - Number(right.protectedByRequest) ||
          Number(right.modality === "isolation") -
            Number(left.modality === "isolation") ||
          Number(right.direct) - Number(left.direct) ||
          right.exerciseIndex - left.exerciseIndex ||
          right.dayIndex - left.dayIndex,
      )[0];
    if (!removal) break;

    corrected = {
      ...corrected,
      days: corrected.days.map((day, dayIndex) => {
        if (dayIndex !== removal.dayIndex) {
          return day;
        }
        const exercises = day.exercises.filter(
          (_, exerciseIndex) => exerciseIndex !== removal.exerciseIndex,
        );
        return {
          ...day,
          exercises,
          estimatedMinutes: estimateSessionDuration(exercises, catalog),
        };
      }),
    };
  }

  return corrected;
}

function buildPlan(
  input: GenerateRoutineInput,
  request: RoutineRequest,
  split: SplitTemplate,
  engineVersion: string,
): RoutinePlan | null {
  const identitySource = JSON.stringify({
    request,
    datasetVersion: input.datasetVersion,
    engineVersion,
    seed: input.seed,
  });
  const planId = deterministicId("routine", identitySource);
  const candidatePool = buildCandidatePool(input.catalog, request);
  const usedExerciseIds = new Set<string>();
  const days: RoutineDay[] = [];

  for (let index = 0; index < split.days.length; index += 1) {
    const dayTemplate = split.days[index];
    if (!dayTemplate) {
      return null;
    }
    const day = buildRoutineDay({
      request,
      dayTemplate,
      dayIndex: index,
      candidatePool,
      catalog: input.catalog,
      seed: input.seed,
      usedExerciseIds,
      planIdentity: planId,
    });
    if (!day) {
      return null;
    }
    day.exercises.forEach((exercise) => usedExerciseIds.add(exercise.exerciseId));
    days.push(day);
  }

  const uncorrectedPlan: RoutinePlan = {
    id: planId,
    title: titleForGoal(request),
    goal: request.goal,
    daysPerWeek: request.daysPerWeek,
    summary: `Rutina determinística de ${split.name.toLowerCase()} compatible con el equipamiento y las restricciones indicadas.`,
    splitId: split.id,
    splitName: split.name,
    days,
    warnings: [],
    assumptions: [
      "La duración es una estimación basada en repeticiones, descansos y transiciones.",
      "RIR es la métrica de esfuerzo autoritativa; no se prescribe una carga automática.",
      ...(request.availableEquipment.length === 0
        ? [
            request.trainingLocation === "commercial_gym"
              ? "Como no se detalló equipamiento, se asumió el equipamiento habitual de un gimnasio comercial."
              : "Como no se detalló equipamiento, se consideraron solamente ejercicios con peso corporal.",
          ]
        : []),
    ],
    generatedAt: generatedAtFromSeed(input.seed),
    engineVersion,
    datasetVersion: input.datasetVersion,
    seed: input.seed,
  };
  return correctWeeklyVolume(uncorrectedPlan, request, input.catalog);
}

export function generateRoutine(input: GenerateRoutineInput): RoutineGenerationResult {
  const requestResult = RoutineRequestSchema.safeParse(input.request);
  const safetyResult = SafetyScreeningSchema.safeParse(input.safetyScreening);
  if (!requestResult.success || !safetyResult.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: [...(!requestResult.success ? requestResult.error.issues : []), ...(!safetyResult.success ? safetyResult.error.issues : [])]
        .map((issue) => issue.message)
        .join("; "),
    };
  }

  const request = requestResult.data;
  const safety = evaluateRoutineSafety(request, safetyResult.data);
  if (!safety.allowed) {
    return {
      ok: false,
      code: "SAFETY_BLOCKED",
      message: safety.message,
      safety,
    };
  }

  if (input.catalog.length === 0) {
    return {
      ok: false,
      code: "INSUFFICIENT_CATALOG",
      message: "No hay ejercicios aprobados y compatibles para construir la rutina.",
      safety,
    };
  }

  const engineVersion = input.engineVersion ?? ENGINE_VERSION;
  const split = chooseSplit(request);
  const plan = buildPlan(input, request, split, engineVersion);
  if (!plan) {
    return {
      ok: false,
      code: "INSUFFICIENT_CATALOG",
      message:
        "El catálogo compatible no alcanza para completar todos los días sin duplicar ejercicios.",
      safety,
    };
  }

  const shape = RoutinePlanSchema.safeParse(plan);
  if (!shape.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: shape.error.issues.map((issue) => issue.message).join("; "),
      safety,
    };
  }

  const validation = validateRoutine(shape.data, request, input.catalog, safetyResult.data);
  if (!validation.valid) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "No se pudo construir una rutina que cumpla todas las reglas configuradas.",
      safety,
      validation,
    };
  }

  return { ok: true, plan: shape.data, validation, safety };
}
