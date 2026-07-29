import type { CatalogExercise } from "../../exercises/catalog-exercise";
import type {
  RoutineExercise,
  RoutineSessionBlock,
} from "../schemas";
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

export function estimateExerciseWorkSeconds(
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[] = [],
): number {
  if (exercises.length === 0) {
    return 0;
  }

  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  let totalSeconds = 0;

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
    if (index < exercises.length - 1) {
      // The clock includes recovery after the last set of the current
      // movement and the separate time needed to change or prepare stations.
      totalSeconds += exercise.restSeconds + SESSION_TIME_RULES.transitionSeconds;
    }
  });

  return totalSeconds;
}

export function estimateExerciseWorkDuration(
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[] = [],
): number {
  const seconds = estimateExerciseWorkSeconds(exercises, catalog);
  return seconds === 0 ? 0 : Math.max(1, Math.ceil(seconds / 60));
}

export function estimateSessionDuration(
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[] = [],
  sessionBlocks?: readonly RoutineSessionBlock[],
): number {
  if (exercises.length === 0) {
    return 0;
  }
  const explicitBlockMinutes =
    sessionBlocks && sessionBlocks.length > 0
      ? sessionBlocks.reduce(
          (total, block) => total + block.estimatedMinutes,
          0,
        )
      : undefined;
  const blockMinutes =
    explicitBlockMinutes ?? SESSION_TIME_RULES.warmupMinutes;
  const workSeconds = estimateExerciseWorkSeconds(exercises, catalog);
  return Math.max(1, Math.ceil((workSeconds + blockMinutes * 60) / 60));
}
