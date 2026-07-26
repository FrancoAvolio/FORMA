import type {
  CatalogExercise,
  MovementPattern,
} from "../../exercises/catalog-exercise";
import {
  hasTextMatch,
  normalizeDomainText,
  normalizeEquipment,
  normalizeMuscle,
} from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";

const EQUIPMENT_COMPATIBILITY: Readonly<Record<string, readonly string[]>> = {
  smith_machine: ["smith_machine"],
  machine: ["machine", "smith_machine"],
  resistance_band: ["resistance_band", "band"],
  weighted: ["weighted", "dumbbell", "barbell", "kettlebell", "machine"],
};

const EQUIPMENT_FREE = new Set(["body_weight", "none"]);

export type CandidatePoolCriteria = {
  allowedMovementPatterns?: readonly MovementPattern[];
  targetMuscles?: readonly string[];
  excludeExerciseIds?: readonly string[];
};

export const COMMERCIAL_GYM_DEFAULT_EQUIPMENT = [
  "body_weight",
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "smith_machine",
  "bench",
  "pull_up_bar",
  "dip_bars",
  "barbell_rack",
  "preacher_bench",
  "hyperextension_bench",
  "band_anchor",
  "glute_ham_developer",
  "stability_ball",
  "step_platform",
] as const;

const LOCATION_EQUIPMENT_DEFAULTS: Readonly<
  Record<RoutineRequest["trainingLocation"], readonly string[]>
> = {
  commercial_gym: COMMERCIAL_GYM_DEFAULT_EQUIPMENT,
  home: ["body_weight"],
  custom: ["body_weight"],
};

export function resolveAvailableEquipment(
  request: RoutineRequest,
): readonly string[] {
  return request.availableEquipment.length > 0
    ? request.availableEquipment
    : LOCATION_EQUIPMENT_DEFAULTS[request.trainingLocation];
}

export function isEquipmentCompatible(
  exercise: CatalogExercise,
  availableEquipment: readonly string[],
): boolean {
  const available = new Set(availableEquipment.map(normalizeEquipment));
  return exercise.equipment.every((item) => {
    const required = normalizeEquipment(item);
    if (EQUIPMENT_FREE.has(required)) {
      return true;
    }
    const alternatives = EQUIPMENT_COMPATIBILITY[required] ?? [required];
    return alternatives.some((alternative) => available.has(alternative));
  });
}

export function isExerciseExplicitlyExcluded(
  exercise: CatalogExercise,
  excludedExercises: readonly string[],
): boolean {
  if (excludedExercises.length === 0) {
    return false;
  }

  const exactIds = new Set(excludedExercises.map(normalizeDomainText));
  if (exactIds.has(normalizeDomainText(exercise.id))) {
    return true;
  }

  return hasTextMatch(
    [exercise.name, exercise.sourceName ?? "", ...exercise.aliases],
    excludedExercises,
  );
}

export function buildCandidatePool(
  catalog: readonly CatalogExercise[],
  request: RoutineRequest,
  criteria: CandidatePoolCriteria = {},
): CatalogExercise[] {
  const allowedPatterns = criteria.allowedMovementPatterns
    ? new Set(criteria.allowedMovementPatterns)
    : undefined;
  const excludedIds = new Set(criteria.excludeExerciseIds ?? []);
  const targetMuscles = new Set(
    (criteria.targetMuscles ?? []).map(normalizeMuscle),
  );

  return catalog
    .filter((exercise) => exercise.approvedForGeneration)
    .filter((exercise) =>
      isEquipmentCompatible(exercise, resolveAvailableEquipment(request)),
    )
    .filter(
      (exercise) =>
        !request.excludedMovementPatterns.includes(exercise.movementPattern),
    )
    .filter(
      (exercise) =>
        !isExerciseExplicitlyExcluded(exercise, request.excludedExercises),
    )
    .filter((exercise) => !excludedIds.has(exercise.id))
    .filter(
      (exercise) => !allowedPatterns || allowedPatterns.has(exercise.movementPattern),
    )
    .filter((exercise) => {
      if (targetMuscles.size === 0) {
        return true;
      }
      return [...exercise.primaryMuscles, ...exercise.secondaryMuscles]
        .map(normalizeMuscle)
        .some((muscle) => targetMuscles.has(muscle));
    })
    .filter(
      (exercise) =>
        request.experience !== "beginner" ||
        exercise.difficulty !== "advanced" ||
        exercise.skillRequirement !== "high",
    )
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}
