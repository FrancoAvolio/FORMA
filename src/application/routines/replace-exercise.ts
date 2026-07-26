import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import { normalizeMuscle } from "../../domain/exercises/normalization";
import type { RoutineRequest } from "../../domain/profile/routine-request";
import type { SafetyScreening } from "../../domain/safety/schemas";
import { assignPrescription } from "../../domain/routine/engine/assign-prescription";
import { buildCandidatePool } from "../../domain/routine/engine/build-candidate-pool";
import { estimateSessionDuration } from "../../domain/routine/engine/estimate-session-duration";
import { findSubstitutions } from "../../domain/routine/engine/find-substitutions";
import { correctWeeklyVolume } from "../../domain/routine/engine/generate-routine";
import { selectionReasons } from "../../domain/routine/engine/score-exercise";
import { getSplitTemplate } from "../../domain/routine/config/split-templates";
import type { RoutinePlan } from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import type { RoutineMutationResult } from "./types";

export type ReplaceRoutineExerciseInput = {
  plan: RoutinePlan;
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
  dayId: string;
  exerciseId: string;
  replacementExerciseId?: string;
  seed: string;
};

function prescribedReplacement(
  replacement: CatalogExercise,
  originalExerciseName: string,
  input: ReplaceRoutineExerciseInput,
  dayIndex: number,
  exerciseIndex: number,
) {
  const split = getSplitTemplate(input.plan.splitId);
  const dayTemplate = split?.days[dayIndex];
  const desiredPattern = dayTemplate?.patternSequence[
    exerciseIndex % (dayTemplate.patternSequence.length || 1)
  ];
  const priority = new Set(input.request.focusMuscles.map(normalizeMuscle));
  const prescription = assignPrescription(replacement, input.request, {
    isPrimaryForDay: exerciseIndex < 2,
    isPriorityMuscle: replacement.primaryMuscles
      .map(normalizeMuscle)
      .some((muscle) => priority.has(muscle)),
  });

  return {
    exerciseId: replacement.id,
    ...prescription,
    selectionReasons: dayTemplate
      ? [
          `Reemplaza a ${originalExerciseName} sin modificar los demás días.`,
          ...selectionReasons(replacement, {
            request: input.request,
            day: dayTemplate,
            desiredPattern,
            selectionIndex: exerciseIndex,
            seed: input.seed,
          }),
        ]
      : [`Reemplaza a ${originalExerciseName} con una alternativa compatible.`],
  };
}

export function replaceRoutineExercise(
  input: ReplaceRoutineExerciseInput,
): RoutineMutationResult {
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  if (dayIndex < 0) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  const day = input.plan.days[dayIndex];
  if (!day) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  const exerciseIndex = day.exercises.findIndex(
    (exercise) => exercise.exerciseId === input.exerciseId,
  );
  if (exerciseIndex < 0) {
    return {
      ok: false,
      code: "EXERCISE_NOT_FOUND",
      message: "No se encontró el ejercicio que querés reemplazar.",
    };
  }

  const original = input.catalog.find((exercise) => exercise.id === input.exerciseId);
  if (!original) {
    return {
      ok: false,
      code: "EXERCISE_NOT_FOUND",
      message: "El ejercicio original ya no está disponible en el catálogo.",
    };
  }
  const usedIds = input.plan.days
    .flatMap((routineDay) => routineDay.exercises)
    .map((exercise) => exercise.exerciseId)
    .filter((id) => id !== input.exerciseId);
  const eligible = buildCandidatePool(input.catalog, input.request, {
    excludeExerciseIds: [...usedIds, input.exerciseId],
  });

  const replacement = input.replacementExerciseId
    ? eligible.find((exercise) => exercise.id === input.replacementExerciseId)
    : findSubstitutions(input.exerciseId, input.catalog, input.request, {
        excludeExerciseIds: usedIds,
        limit: 1,
        seed: input.seed,
      })[0];

  if (!replacement) {
    return {
      ok: false,
      code: input.replacementExerciseId
        ? "INELIGIBLE_REPLACEMENT"
        : "NO_SUBSTITUTION",
      message: input.replacementExerciseId
        ? "El reemplazo elegido no es compatible con el equipamiento o las restricciones."
        : "No encontramos una sustitución aprobada y compatible.",
    };
  }

  const replacementPrescription = prescribedReplacement(
    replacement,
    original.name,
    input,
    dayIndex,
    exerciseIndex,
  );
  const nextDay = {
    ...day,
    exercises: day.exercises.map((exercise, index) =>
      index === exerciseIndex ? replacementPrescription : exercise,
    ),
  };
  nextDay.estimatedMinutes = estimateSessionDuration(nextDay.exercises, input.catalog);
  const uncorrectedPlan = {
    ...input.plan,
    days: input.plan.days.map((routineDay, index) =>
      index === dayIndex ? nextDay : routineDay,
    ),
  };
  const nextPlan = correctWeeklyVolume(
    uncorrectedPlan,
    input.request,
    input.catalog,
    { mutableDayIndexes: new Set([dayIndex]) },
  );
  const validation = validateRoutine(
    nextPlan,
    input.request,
    input.catalog,
    input.safetyScreening,
  );
  if (!validation.valid) {
    return {
      ok: false,
      code: "INELIGIBLE_REPLACEMENT",
      message: "El reemplazo no mantiene una rutina válida.",
      candidatePlan: nextPlan,
      validation,
    };
  }
  return { ok: true, plan: nextPlan, validation };
}

export function findRoutineExerciseSubstitutions(
  input: Omit<ReplaceRoutineExerciseInput, "replacementExerciseId"> & { limit?: number },
): CatalogExercise[] {
  const usedIds = input.plan.days
    .flatMap((day) => day.exercises)
    .map((exercise) => exercise.exerciseId)
    .filter((id) => id !== input.exerciseId);
  return findSubstitutions(input.exerciseId, input.catalog, input.request, {
    excludeExerciseIds: usedIds,
    limit: input.limit,
    seed: input.seed,
  });
}
