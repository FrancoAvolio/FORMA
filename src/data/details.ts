import detailCatalog from "./generated/exercise-details.json";
import { ExerciseDetailSchema } from "./schemas";
import type { ExerciseDetail } from "./types";

const details = ExerciseDetailSchema.array().parse(detailCatalog.exercises);
const detailById = new Map(details.map((exercise) => [exercise.id, exercise]));

export function getExerciseDetailById(exerciseId: string): ExerciseDetail | null {
  return detailById.get(exerciseId) ?? null;
}
