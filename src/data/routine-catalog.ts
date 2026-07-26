import { CatalogExerciseSchema, type CatalogExercise } from "@/domain/exercises";

import generatedRoutineCatalog from "./generated/routine-catalog.json";

const routineCatalog = CatalogExerciseSchema.array().parse(
  generatedRoutineCatalog.exercises,
) as CatalogExercise[];

export function getRoutineCatalog(): readonly CatalogExercise[] {
  return routineCatalog;
}

