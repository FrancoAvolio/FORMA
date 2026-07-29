import {
  CatalogExerciseSchema,
  type CatalogExercise,
  type MovementPattern,
} from "../../exercises/catalog-exercise";
import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import type { SafetyScreening } from "../../safety/schemas";
import { evaluateRoutineSafety } from "../../safety/evaluate-safety";
import {
  REST_LIMITS_SECONDS,
  SET_LIMITS,
} from "../config/rep-rules";
import { sessionTimeBounds } from "../config/session-time";
import { getSplitTemplate } from "../config/split-templates";
import { WEEKLY_VOLUME_RULES } from "../config/volume-rules";
import {
  buildCandidatePool,
  isEquipmentCompatible,
  isExerciseExplicitlyExcluded,
  resolveAvailableEquipment,
} from "../engine/build-candidate-pool";
import { calculateWeeklyVolume } from "../engine/calculate-weekly-volume";
import {
  estimateSessionDuration,
  parseRepRange,
} from "../engine/estimate-session-duration";
import { RoutinePlanSchema, type RoutinePlan } from "../schemas";

export type RoutineValidationSeverity = "error" | "warning";

export type RoutineValidationCode =
  | "INVALID_PLAN_SHAPE"
  | "GOAL_MISMATCH"
  | "DAY_COUNT_MISMATCH"
  | "UNKNOWN_SPLIT"
  | "SPLIT_DAY_COUNT_MISMATCH"
  | "SAFETY_NOT_VERIFIED"
  | "SAFETY_BLOCKED"
  | "UNKNOWN_EXERCISE"
  | "UNAPPROVED_EXERCISE"
  | "INVALID_EXERCISE_METADATA"
  | "INCOMPATIBLE_EQUIPMENT"
  | "EXCLUDED_EXERCISE"
  | "EXCLUDED_MOVEMENT_PATTERN"
  | "DUPLICATE_EXERCISE"
  | "INVALID_SET_COUNT"
  | "INVALID_REP_PRESCRIPTION"
  | "INVALID_REST"
  | "INVALID_RIR"
  | "INVALID_SESSION_BLOCK_REFERENCE"
  | "DURATION_MISMATCH"
  | "DURATION_OUT_OF_RANGE"
  | "WEEKLY_VOLUME_TOO_HIGH"
  | "FOCUS_VOLUME_TOO_LOW"
  | "PUSH_PULL_IMBALANCE"
  | "LOWER_BODY_PATTERN_MISSING"
  | "RECOVERY_WARNING";

export type RoutineValidationIssue = {
  code: RoutineValidationCode;
  severity: RoutineValidationSeverity;
  message: string;
  path?: string;
};

export type RoutineValidationResult = {
  valid: boolean;
  issues: RoutineValidationIssue[];
  errors: RoutineValidationIssue[];
  warnings: RoutineValidationIssue[];
};

function pushIssue(
  issues: RoutineValidationIssue[],
  code: RoutineValidationCode,
  severity: RoutineValidationSeverity,
  message: string,
  path?: string,
): void {
  issues.push({ code, severity, message, ...(path ? { path } : {}) });
}

function countMovementPatterns(
  plan: RoutinePlan,
  catalogById: ReadonlyMap<string, CatalogExercise>,
): Map<MovementPattern, number> {
  const result = new Map<MovementPattern, number>();
  for (const day of plan.days) {
    for (const prescribed of day.exercises) {
      const pattern = catalogById.get(prescribed.exerciseId)?.movementPattern;
      if (pattern) {
        result.set(pattern, (result.get(pattern) ?? 0) + 1);
      }
    }
  }
  return result;
}

function validateMovementBalance(
  issues: RoutineValidationIssue[],
  plan: RoutinePlan,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  catalogById: ReadonlyMap<string, CatalogExercise>,
): void {
  const counts = countMovementPatterns(plan, catalogById);
  const feasiblePool = buildCandidatePool(catalog, request);
  const pushes =
    (counts.get("horizontal_push") ?? 0) + (counts.get("vertical_push") ?? 0);
  const pulls =
    (counts.get("horizontal_pull") ?? 0) + (counts.get("vertical_pull") ?? 0);
  const pushExcluded = ["horizontal_push", "vertical_push"].every((pattern) =>
    request.excludedMovementPatterns.includes(pattern as MovementPattern),
  );
  const pullExcluded = ["horizontal_pull", "vertical_pull"].every((pattern) =>
    request.excludedMovementPatterns.includes(pattern as MovementPattern),
  );
  const feasiblePushCount = feasiblePool.filter((exercise) =>
    ["horizontal_push", "vertical_push"].includes(exercise.movementPattern),
  ).length;
  const feasiblePullCount = feasiblePool.filter((exercise) =>
    ["horizontal_pull", "vertical_pull"].includes(exercise.movementPattern),
  ).length;
  const minimumDistinctPerDirection = Math.min(2, request.daysPerWeek);
  const catalogCanBalance =
    feasiblePushCount >= minimumDistinctPerDirection &&
    feasiblePullCount >= minimumDistinctPerDirection;

  if (
    !pushExcluded &&
    !pullExcluded &&
    pushes + pulls >= 3
  ) {
    const smaller = Math.max(1, Math.min(pushes, pulls));
    const ratio = Math.max(pushes, pulls) / smaller;
    if (pushes === 0 || pulls === 0 || ratio > 2.5) {
      pushIssue(
        issues,
        "PUSH_PULL_IMBALANCE",
        catalogCanBalance ? "error" : "warning",
        catalogCanBalance
          ? "La rutina no mantiene un equilibrio razonable entre empujes y tracciones."
          : "El equipamiento y el catálogo compatible no ofrecen suficientes ejercicios distintos para equilibrar completamente empujes y tracciones.",
      );
    }
  }

  const expectsLowerBody = plan.days.some((day) =>
    day.focus.map(normalizeMuscle).some((muscle) =>
      ["quadriceps", "hamstrings", "glutes"].includes(muscle),
    ),
  );
  const lowerPatterns =
    (counts.get("squat") ?? 0) +
    (counts.get("hinge") ?? 0) +
    (counts.get("lunge") ?? 0);
  const allLowerPatternsExcluded = ["squat", "hinge", "lunge"].every((pattern) =>
    request.excludedMovementPatterns.includes(pattern as MovementPattern),
  );
  if (expectsLowerBody && !allLowerPatternsExcluded && lowerPatterns === 0) {
    pushIssue(
      issues,
      "LOWER_BODY_PATTERN_MISSING",
      "error",
      "La distribución incluye tren inferior pero no contiene un patrón principal de piernas.",
    );
  }
}

function validateRecovery(
  issues: RoutineValidationIssue[],
  plan: RoutinePlan,
  catalogById: ReadonlyMap<string, CatalogExercise>,
): void {
  const dailyPrimaryMuscles = plan.days.map((day) => {
    const muscles = new Set<string>();
    for (const prescribed of day.exercises) {
      for (const muscle of catalogById.get(prescribed.exerciseId)?.primaryMuscles ?? []) {
        muscles.add(normalizeMuscle(muscle));
      }
    }
    return muscles;
  });

  for (let index = 1; index < dailyPrimaryMuscles.length; index += 1) {
    const previous = dailyPrimaryMuscles[index - 1];
    const current = dailyPrimaryMuscles[index];
    const overlap = [...current].filter((muscle) => previous.has(muscle));
    const smallerSize = Math.max(1, Math.min(previous.size, current.size));
    if (overlap.length / smallerSize > 0.75 && plan.daysPerWeek >= 4) {
      pushIssue(
        issues,
        "RECOVERY_WARNING",
        "warning",
        `${plan.days[index - 1]?.name ?? "Un día"} y ${plan.days[index]?.name ?? "el día siguiente"} repiten gran parte del foco muscular. Distribuí las sesiones con descanso suficiente.`,
        `days.${index}`,
      );
    }
  }
}

export function validateRoutine(
  plan: RoutinePlan,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  safetyScreening?: SafetyScreening,
): RoutineValidationResult {
  const issues: RoutineValidationIssue[] = [];
  const planShape = RoutinePlanSchema.safeParse(plan);
  if (!planShape.success) {
    pushIssue(
      issues,
      "INVALID_PLAN_SHAPE",
      "error",
      planShape.error.issues.map((issue) => issue.message).join("; "),
    );
  }

  if (plan.goal !== request.goal) {
    pushIssue(issues, "GOAL_MISMATCH", "error", "El objetivo del plan no coincide con el pedido.");
  }
  if (plan.daysPerWeek !== request.daysPerWeek || plan.days.length !== request.daysPerWeek) {
    pushIssue(
      issues,
      "DAY_COUNT_MISMATCH",
      "error",
      `Se solicitaron ${request.daysPerWeek} días y el plan contiene ${plan.days.length}.`,
    );
  }

  const split = getSplitTemplate(plan.splitId);
  if (!split) {
    pushIssue(issues, "UNKNOWN_SPLIT", "error", `La división ${plan.splitId} no está versionada.`);
  } else if (split.days.length !== plan.days.length) {
    pushIssue(
      issues,
      "SPLIT_DAY_COUNT_MISMATCH",
      "error",
      "La cantidad de días no coincide con la plantilla seleccionada.",
    );
  }

  if (!safetyScreening) {
    pushIssue(
      issues,
      "SAFETY_NOT_VERIFIED",
      "error",
      "Falta la confirmación de seguridad previa a la generación.",
    );
  } else {
    const safety = evaluateRoutineSafety(request, safetyScreening);
    if (!safety.allowed) {
      pushIssue(issues, "SAFETY_BLOCKED", "error", safety.message);
    }
  }

  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const seenExerciseIds = new Set<string>();

  plan.days.forEach((day, dayIndex) => {
    const dayExerciseIds = new Set(
      day.exercises.map((exercise) => exercise.exerciseId),
    );
    (day.sessionBlocks ?? []).forEach((block, blockIndex) => {
      const unknownReference = block.relatedExerciseIds.find(
        (exerciseId) => !dayExerciseIds.has(exerciseId),
      );
      if (unknownReference) {
        pushIssue(
          issues,
          "INVALID_SESSION_BLOCK_REFERENCE",
          "error",
          `El bloque ${block.title} referencia un ejercicio que no pertenece a ese d\u00eda.`,
          `days.${dayIndex}.sessionBlocks.${blockIndex}`,
        );
      }
    });

    day.exercises.forEach((prescribed, exerciseIndex) => {
      const path = `days.${dayIndex}.exercises.${exerciseIndex}`;
      const exercise = catalogById.get(prescribed.exerciseId);
      if (!exercise) {
        pushIssue(
          issues,
          "UNKNOWN_EXERCISE",
          "error",
          `El ejercicio ${prescribed.exerciseId} no existe en el catálogo inyectado.`,
          path,
        );
        return;
      }
      if (!CatalogExerciseSchema.safeParse(exercise).success) {
        pushIssue(
          issues,
          "INVALID_EXERCISE_METADATA",
          "error",
          `El ejercicio ${exercise.id} no tiene metadatos de programación válidos.`,
          path,
        );
      }
      if (!exercise.approvedForGeneration) {
        pushIssue(
          issues,
          "UNAPPROVED_EXERCISE",
          "error",
          `El ejercicio ${exercise.id} no está aprobado para rutinas automáticas.`,
          path,
        );
      }
      if (!isEquipmentCompatible(exercise, resolveAvailableEquipment(request))) {
        pushIssue(
          issues,
          "INCOMPATIBLE_EQUIPMENT",
          "error",
          `${exercise.name} requiere equipamiento que no está disponible.`,
          path,
        );
      }
      if (isExerciseExplicitlyExcluded(exercise, request.excludedExercises)) {
        pushIssue(
          issues,
          "EXCLUDED_EXERCISE",
          "error",
          `${exercise.name} fue excluido por la persona usuaria.`,
          path,
        );
      }
      if (request.excludedMovementPatterns.includes(exercise.movementPattern)) {
        pushIssue(
          issues,
          "EXCLUDED_MOVEMENT_PATTERN",
          "error",
          `${exercise.name} usa un patrón de movimiento excluido.`,
          path,
        );
      }
      if (seenExerciseIds.has(exercise.id)) {
        pushIssue(
          issues,
          "DUPLICATE_EXERCISE",
          "error",
          `${exercise.name} aparece más de una vez en la rutina.`,
          path,
        );
      }
      seenExerciseIds.add(exercise.id);

      if (prescribed.sets < SET_LIMITS.minimum || prescribed.sets > SET_LIMITS.maximum) {
        pushIssue(issues, "INVALID_SET_COUNT", "error", "La cantidad de series está fuera de rango.", path);
      }
      if (!parseRepRange(prescribed.repPrescription)) {
        pushIssue(
          issues,
          "INVALID_REP_PRESCRIPTION",
          "error",
          "La prescripción de repeticiones no es un rango válido.",
          path,
        );
      }
      if (
        prescribed.restSeconds < REST_LIMITS_SECONDS.minimum ||
        prescribed.restSeconds > REST_LIMITS_SECONDS.maximum
      ) {
        pushIssue(issues, "INVALID_REST", "error", "El descanso está fuera de rango.", path);
      }
      if (prescribed.rir !== null && (prescribed.rir < 0 || prescribed.rir > 5)) {
        pushIssue(issues, "INVALID_RIR", "error", "El RIR está fuera de rango.", path);
      }
    });

    const estimated = estimateSessionDuration(
      day.exercises,
      catalog,
      day.sessionBlocks ?? [],
    );
    if (Math.abs(estimated - day.estimatedMinutes) > 1) {
      pushIssue(
        issues,
        "DURATION_MISMATCH",
        "error",
        `La duración guardada (${day.estimatedMinutes} min) no coincide con la estimación (${estimated} min).`,
        `days.${dayIndex}.estimatedMinutes`,
      );
    }
    const { lower: lowerBound, upper: upperBound } = sessionTimeBounds(
      request.sessionMinutes,
    );
    if (estimated > upperBound) {
      pushIssue(
        issues,
        "DURATION_OUT_OF_RANGE",
        "error",
        `${day.name} dura aproximadamente ${estimated} minutos y supera el máximo aceptado de ${upperBound}.`,
        `days.${dayIndex}.estimatedMinutes`,
      );
    } else if (estimated < lowerBound) {
      pushIssue(
        issues,
        "DURATION_OUT_OF_RANGE",
        "warning",
        `${day.name} dura aproximadamente ${estimated} minutos y queda por debajo del objetivo m\u00ednimo de ${lowerBound}.`,
        `days.${dayIndex}.estimatedMinutes`,
      );
    }
  });

  const weeklyVolume = calculateWeeklyVolume(plan, catalog);
  const volumeRule = WEEKLY_VOLUME_RULES[request.goal][request.experience];
  Object.entries(weeklyVolume).forEach(([muscle, volume]) => {
    if (volume.totalSets > volumeRule.maximumSets) {
      pushIssue(
        issues,
        "WEEKLY_VOLUME_TOO_HIGH",
        "error",
        `${muscle} acumula ${volume.totalSets} series equivalentes; el máximo configurado es ${volumeRule.maximumSets}.`,
      );
    }
  });

  const minimumFocusSets = Math.min(
    volumeRule.minimumFocusSets,
    Math.max(2, request.daysPerWeek * 2),
  );
  for (const rawFocusMuscle of request.focusMuscles) {
    const muscle = normalizeMuscle(rawFocusMuscle);
    if ((weeklyVolume[muscle]?.directSets ?? 0) < minimumFocusSets) {
      pushIssue(
        issues,
        "FOCUS_VOLUME_TOO_LOW",
        "error",
        `El foco ${rawFocusMuscle} no alcanza el mínimo configurado de ${minimumFocusSets} series directas.`,
      );
    }
  }

  validateMovementBalance(issues, plan, request, catalog, catalogById);
  validateRecovery(issues, plan, catalogById);

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { valid: errors.length === 0, issues, errors, warnings };
}
