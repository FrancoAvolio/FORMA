import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import type { RoutineRequest } from "../../domain/profile/routine-request";
import type { SafetyScreening } from "../../domain/safety/schemas";
import { getSplitTemplate } from "../../domain/routine/config/split-templates";
import { buildCandidatePool } from "../../domain/routine/engine/build-candidate-pool";
import {
  buildRoutineDay,
  correctWeeklyVolume,
} from "../../domain/routine/engine/generate-routine";
import { fitRoutineSessionDurations } from "../../domain/routine/engine/fit-session-duration";
import type { RoutinePlan } from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import type { RoutineMutationResult } from "./types";

export type RegenerateRoutineDayInput = {
  plan: RoutinePlan;
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
  dayId: string;
  seed: string;
};

export function regenerateRoutineDay(
  input: RegenerateRoutineDayInput,
): RoutineMutationResult {
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  if (dayIndex < 0) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  const split = getSplitTemplate(input.plan.splitId);
  const dayTemplate = split?.days[dayIndex];
  if (!dayTemplate) {
    return {
      ok: false,
      code: "DAY_NOT_FOUND",
      message: "La plantilla de este día ya no está disponible.",
    };
  }

  const unaffectedDays = input.plan.days.filter((_, index) => index !== dayIndex);
  const usedExerciseIds = new Set(
    unaffectedDays.flatMap((day) => day.exercises.map((exercise) => exercise.exerciseId)),
  );
  const currentDayExerciseIds = new Set(
    input.plan.days[dayIndex]?.exercises.map((exercise) => exercise.exerciseId) ?? [],
  );
  const candidatePool = buildCandidatePool(input.catalog, input.request, {
    excludeExerciseIds: [...currentDayExerciseIds],
  });
  const regenerated = buildRoutineDay({
    request: input.request,
    dayTemplate,
    dayIndex,
    candidatePool,
    catalog: input.catalog,
    seed: `${input.plan.seed}:regenerate:${input.seed}`,
    usedExerciseIds,
    planIdentity: input.plan.id,
  });
  if (!regenerated) {
    return {
      ok: false,
      code: "INSUFFICIENT_CATALOG",
      message: "No hay suficientes ejercicios compatibles para regenerar este día.",
    };
  }

  const uncorrectedPlan = {
    ...input.plan,
    days: input.plan.days.map((day, index) =>
      index === dayIndex ? regenerated : day,
    ),
  };
  const volumeCorrected = correctWeeklyVolume(
    uncorrectedPlan,
    input.request,
    input.catalog,
    { mutableDayIndexes: new Set([dayIndex]) },
  );
  const nextPlan = fitRoutineSessionDurations({
    plan: volumeCorrected,
    request: input.request,
    catalog: input.catalog,
    split,
    mutableDayIndexes: new Set([dayIndex]),
  });
  const validation = validateRoutine(
    nextPlan,
    input.request,
    input.catalog,
    input.safetyScreening,
  );
  if (!validation.valid) {
    return {
      ok: false,
      code: "INSUFFICIENT_CATALOG",
      message: "El día regenerado no mantiene todas las reglas de la rutina.",
      candidatePlan: nextPlan,
      validation,
    };
  }
  return { ok: true, plan: nextPlan, validation };
}
