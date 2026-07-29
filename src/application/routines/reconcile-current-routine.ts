import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "../../domain/profile/routine-request";
import type { RoutinePlan } from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import { evaluateRoutineSafety } from "../../domain/safety/evaluate-safety";
import type { SafetyScreening } from "../../domain/safety/schemas";

export type CurrentRoutineSnapshot = {
  request: RoutineRequest;
  plan: RoutinePlan;
  safetyScreening: SafetyScreening;
  updatedAt: string;
};

function sameRequest(left: RoutineRequest, right: RoutineRequest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Prevents the manual profile and inline plan from drifting. A plan can keep
 * its exercise identities only when it validates against the edited request;
 * otherwise the stale current-plan pointer is removed without touching saved
 * routines or conversation messages.
 */
export function reconcileCurrentRoutineAfterManualEdit(options: {
  currentRoutine: CurrentRoutineSnapshot | null;
  nextRequest: RoutineRequest | null;
  nextSafetyScreening: SafetyScreening | null;
  catalog: readonly CatalogExercise[];
  updatedAt: string;
}): CurrentRoutineSnapshot | null {
  const current = options.currentRoutine;
  if (!current) return null;
  const nextResult = RoutineRequestSchema.safeParse(options.nextRequest);
  if (!nextResult.success) return null;
  const nextRequest = nextResult.data;

  if (sameRequest(current.request, nextRequest)) return current;
  if (current.request.sessionMinutes !== nextRequest.sessionMinutes) {
    return null;
  }
  if (!options.nextSafetyScreening) return null;
  if (!evaluateRoutineSafety(nextRequest, options.nextSafetyScreening).allowed) {
    return null;
  }
  const validation = validateRoutine(
    current.plan,
    nextRequest,
    options.catalog,
    options.nextSafetyScreening,
  );
  if (!validation.valid) return null;

  return {
    ...current,
    request: nextRequest,
    safetyScreening: options.nextSafetyScreening,
    updatedAt: options.updatedAt,
  };
}
