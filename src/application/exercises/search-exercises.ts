import { getExerciseSummaries } from "@/data/catalog";
import {
  searchExerciseResults,
  type ExerciseSearchFilters as DataSearchFilters,
} from "@/data/search";
import type { ExerciseSummary } from "@/data/types";

export type ExerciseSearchFilters = {
  query?: string;
  muscle?: string;
  bodyPart?: string;
  equipment?: string;
  pattern?: string;
  difficulty?: string;
  approvedOnly?: boolean;
  mediaOnly?: boolean;
  offset?: number;
  limit?: number;
};

export type ExerciseSearchResult = {
  exercises: ExerciseSummary[];
  total: number;
  offset: number;
  limit: number;
};

export function searchExercises(filters: ExerciseSearchFilters): ExerciseSearchResult {
  const dataFilters: DataSearchFilters = {
    ...(filters.muscle ? { primaryMuscle: filters.muscle } : {}),
    ...(filters.bodyPart ? { bodyPart: filters.bodyPart } : {}),
    ...(filters.equipment ? { equipment: filters.equipment } : {}),
    ...(filters.pattern ? { movementPattern: filters.pattern } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty } : {}),
    ...(filters.approvedOnly ? { approvedOnly: true } : {}),
    ...(filters.mediaOnly ? { mediaAvailable: true } : {}),
  };
  const matches = searchExerciseResults(filters.query?.trim() ?? "", dataFilters);
  const offset = Math.max(0, filters.offset ?? 0);
  const limit = Math.min(48, Math.max(1, filters.limit ?? 18));

  return {
    exercises: matches.slice(offset, offset + limit),
    total: matches.length,
    offset,
    limit,
  };
}

export function getExerciseFilterOptions() {
  const allExercises = getExerciseSummaries();
  const values = <T>(items: Iterable<T>) =>
    [...new Set(items)].filter(Boolean).sort((left, right) =>
      String(left).localeCompare(String(right), "es"),
    );

  return {
    muscles: values(allExercises.flatMap((exercise) => exercise.primaryMuscles)),
    bodyParts: values(allExercises.map((exercise) => exercise.bodyPart)),
    equipment: values(allExercises.map((exercise) => exercise.equipment)),
    patterns: values(
      allExercises.flatMap((exercise) =>
        exercise.movementPattern ? [exercise.movementPattern] : [],
      ),
    ),
    difficulties: values(
      allExercises.flatMap((exercise) =>
        exercise.difficulty ? [exercise.difficulty] : [],
      ),
    ),
  };
}
