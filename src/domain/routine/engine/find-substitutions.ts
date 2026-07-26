import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import { buildCandidatePool } from "./build-candidate-pool";
import { deterministicUnitInterval } from "./seed";

export type SubstitutionOptions = {
  excludeExerciseIds?: readonly string[];
  limit?: number;
  seed?: string;
};

function muscleOverlap(
  left: readonly string[],
  right: readonly string[],
): number {
  const rightSet = new Set(right.map(normalizeMuscle));
  return left.map(normalizeMuscle).filter((muscle) => rightSet.has(muscle)).length;
}

export function findSubstitutions(
  exerciseId: string,
  catalog: readonly CatalogExercise[],
  request: RoutineRequest,
  options: SubstitutionOptions = {},
): CatalogExercise[] {
  const original = catalog.find((exercise) => exercise.id === exerciseId);
  if (!original) {
    return [];
  }

  const excluded = new Set([exerciseId, ...(options.excludeExerciseIds ?? [])]);
  const candidates = buildCandidatePool(catalog, request, {
    excludeExerciseIds: [...excluded],
  });
  const seed = options.seed ?? "substitutions";

  return candidates
    .map((candidate) => {
      let score = 0;
      if (candidate.substitutionGroup === original.substitutionGroup) {
        score += 100;
      }
      if (candidate.movementPattern === original.movementPattern) {
        score += 55;
      }
      if (candidate.modality === original.modality) {
        score += 12;
      }
      if (candidate.laterality === original.laterality) {
        score += 6;
      }
      if (candidate.difficulty === original.difficulty) {
        score += 5;
      }
      score += muscleOverlap(candidate.primaryMuscles, original.primaryMuscles) * 24;
      score += muscleOverlap(candidate.secondaryMuscles, original.secondaryMuscles) * 5;
      score += deterministicUnitInterval(seed, `${original.id}:${candidate.id}`);
      return { candidate, score };
    })
    .filter(({ candidate }) =>
      candidate.primaryMuscles
        .map(normalizeMuscle)
        .some((muscle) => original.primaryMuscles.map(normalizeMuscle).includes(muscle)),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.candidate.id.localeCompare(right.candidate.id, "en"),
    )
    .slice(0, options.limit ?? 5)
    .map(({ candidate }) => candidate);
}

