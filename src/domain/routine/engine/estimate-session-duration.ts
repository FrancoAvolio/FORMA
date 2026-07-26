import type { CatalogExercise } from "../../exercises/catalog-exercise";
import type { RoutineExercise } from "../schemas";
import { SESSION_TIME_RULES } from "../config/session-time";

export function parseRepRange(repPrescription: string): readonly [number, number] | null {
  const match = repPrescription.match(/^(\d+)\s*[\u2013-]\s*(\d+)$/);
  if (!match) {
    return null;
  }
  const minimum = Number(match[1]);
  const maximum = Number(match[2]);
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    return null;
  }
  return [minimum, maximum];
}

export function estimateSessionDuration(
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[] = [],
): number {
  if (exercises.length === 0) {
    return 0;
  }

  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  let totalSeconds = SESSION_TIME_RULES.warmupMinutes * 60;

  exercises.forEach((exercise, index) => {
    const repetitions = parseRepRange(exercise.repPrescription) ?? [8, 12];
    const averageRepetitions = (repetitions[0] + repetitions[1]) / 2;
    const catalogExercise = catalogById.get(exercise.exerciseId);
    const lateralityMultiplier =
      catalogExercise?.laterality === "unilateral"
        ? SESSION_TIME_RULES.unilateralRepetitionMultiplier
        : 1;
    const activeSeconds =
      exercise.sets *
      averageRepetitions *
      SESSION_TIME_RULES.repetitionSeconds *
      lateralityMultiplier;
    const restSeconds = Math.max(0, exercise.sets - 1) * exercise.restSeconds;
    totalSeconds += activeSeconds + restSeconds;
    if (index > 0) {
      totalSeconds += SESSION_TIME_RULES.transitionSeconds;
    }
  });

  return Math.max(1, Math.ceil(totalSeconds / 60));
}
