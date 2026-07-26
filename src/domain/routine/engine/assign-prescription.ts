import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import {
  REP_RULES,
  REST_LIMITS_SECONDS,
  SET_LIMITS,
} from "../config/rep-rules";

export type AssignedPrescription = {
  sets: number;
  repPrescription: string;
  restSeconds: number;
  rir: number;
  tempo: null;
  notes: string[];
};

export type PrescriptionContext = {
  isPrimaryForDay?: boolean;
  isPriorityMuscle?: boolean;
};

function intersectOrPreferRule(
  preferred: readonly [number, number],
  exerciseDefault: readonly [number, number],
): readonly [number, number] {
  const minimum = Math.max(preferred[0], exerciseDefault[0]);
  const maximum = Math.min(preferred[1], exerciseDefault[1]);
  return minimum <= maximum ? [minimum, maximum] : preferred;
}

function midpoint(range: readonly [number, number]): number {
  return Math.round((range[0] + range[1]) / 2);
}

export function assignPrescription(
  exercise: CatalogExercise,
  request: RoutineRequest,
  context: PrescriptionContext = {},
): AssignedPrescription {
  const rule = REP_RULES[request.goal][exercise.modality];
  const repetitions = intersectOrPreferRule(
    rule.repetitions,
    exercise.defaultRepRange,
  );
  const restIntersection = intersectOrPreferRule(
    rule.restSeconds,
    exercise.defaultRestSeconds,
  );

  let sets = rule.sets[request.experience];
  const priorityMuscles = new Set(request.focusMuscles.map(normalizeMuscle));
  const exerciseIsPriority = exercise.primaryMuscles
    .map(normalizeMuscle)
    .some((muscle) => priorityMuscles.has(muscle));

  if (
    request.goal === "hypertrophy" &&
    request.experience !== "beginner" &&
    context.isPrimaryForDay &&
    (context.isPriorityMuscle || exerciseIsPriority)
  ) {
    sets += 1;
  }

  sets = Math.min(SET_LIMITS.maximum, Math.max(SET_LIMITS.minimum, sets));
  const restSeconds = Math.min(
    REST_LIMITS_SECONDS.maximum,
    Math.max(REST_LIMITS_SECONDS.minimum, midpoint(restIntersection)),
  );

  return {
    sets,
    repPrescription: `${repetitions[0]}\u2013${repetitions[1]}`,
    restSeconds,
    rir: rule.rir[request.experience],
    tempo: null,
    notes: [
      "Usá una carga que te permita mantener la técnica y terminar dentro del RIR indicado.",
    ],
  };
}

/** Presentation-only conversion. RIR remains the stored and authoritative metric. */
export function rirToRpe(rir: number | null): number | null {
  return rir === null ? null : Math.max(5, Math.min(10, 10 - rir));
}
