import type { CatalogExercise } from "../../exercises/catalog-exercise";
import type { RoutineRequest } from "../../profile/routine-request";
import type { SplitDayTemplate } from "../config/split-templates";
import { scoreExercise } from "./score-exercise";

export type ExerciseSelectionContext = {
  request: RoutineRequest;
  day: SplitDayTemplate;
  count: number;
  seed: string;
  usedExerciseIds?: ReadonlySet<string>;
};

export function selectExercises(
  candidatePool: readonly CatalogExercise[],
  context: ExerciseSelectionContext,
): CatalogExercise[] {
  const selected: CatalogExercise[] = [];
  const usedExerciseIds = context.usedExerciseIds ?? new Set<string>();

  for (let index = 0; index < context.count; index += 1) {
    const desiredPattern =
      context.day.patternSequence[index % context.day.patternSequence.length];
    const candidates = candidatePool.filter(
      (exercise) =>
        !usedExerciseIds.has(exercise.id) &&
        !selected.some((selectedExercise) => selectedExercise.id === exercise.id),
    );

    if (candidates.length === 0) {
      break;
    }

    const unusedGroups = candidates.filter(
      (exercise) =>
        !selected.some(
          (selectedExercise) =>
            selectedExercise.substitutionGroup === exercise.substitutionGroup,
        ),
    );
    const patternMatches = unusedGroups.filter(
      (exercise) => exercise.movementPattern === desiredPattern,
    );
    const eligible =
      patternMatches.length > 0
        ? patternMatches
        : unusedGroups.length > 0
          ? unusedGroups
          : candidates;

    const chosen = [...eligible].sort((left, right) => {
      const leftScore = scoreExercise(left, {
        ...context,
        desiredPattern,
        selectionIndex: index,
        selectedExercises: selected,
        usedExerciseIds,
      });
      const rightScore = scoreExercise(right, {
        ...context,
        desiredPattern,
        selectionIndex: index,
        selectedExercises: selected,
        usedExerciseIds,
      });
      return rightScore - leftScore || left.id.localeCompare(right.id, "en");
    })[0];

    if (!chosen) {
      break;
    }
    selected.push(chosen);
  }

  return selected;
}

