import compactCatalog from "./generated/exercises.compact.json";
import { ExerciseSummarySchema } from "./schemas";
import type { ExerciseSummary } from "./types";

const summaries = ExerciseSummarySchema.array().parse(compactCatalog.exercises);
const summaryById = new Map(summaries.map((exercise) => [exercise.id, exercise]));

export const EXERCISE_DATASET_COMMIT = compactCatalog.datasetCommit;

export function getExerciseSummaries(): readonly ExerciseSummary[] {
  return summaries;
}

export function getExerciseSummaryById(exerciseId: string): ExerciseSummary | null {
  return summaryById.get(exerciseId) ?? null;
}
