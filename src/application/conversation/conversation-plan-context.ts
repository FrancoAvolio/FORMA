import {
  RoutinePlanContextSchema,
  type RoutineModificationResult,
} from "../../ai/schemas/routine-modification";
import {
  ValidatedPlanSummarySchema,
} from "../../ai/schemas/explanation";
import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import type { RoutineRequest } from "../../domain/profile/routine-request";
import type { RoutinePlan } from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import type { SafetyScreening } from "../../domain/safety/schemas";
import type { z } from "zod";

export type RoutinePlanContext = z.output<typeof RoutinePlanContextSchema>;

export type ValidatedPlanSummary = z.output<
  typeof ValidatedPlanSummarySchema
>;

function exerciseName(
  exerciseId: string,
  catalogById: ReadonlyMap<string, CatalogExercise>,
): string {
  return catalogById.get(exerciseId)?.name ?? `Ejercicio ${exerciseId}`;
}

/** Bounded plan identity supplied to the modification parser. */
export function buildRoutinePlanContext(
  plan: RoutinePlan,
  catalog: readonly CatalogExercise[],
): RoutinePlanContext {
  const catalogById = new Map(
    catalog.map((exercise) => [exercise.id, exercise]),
  );
  return RoutinePlanContextSchema.parse({
    routineId: plan.id,
    days: plan.days.map((day) => ({
      dayId: day.id,
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        displayName: exerciseName(exercise.exerciseId, catalogById),
      })),
    })),
  });
}

/**
 * Revalidates the authoritative plan before any facts are exposed to an AI
 * provider. A caller must handle null as invalid persisted or mutated state.
 */
export function buildValidatedPlanSummary(options: {
  plan: RoutinePlan;
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
}): ValidatedPlanSummary | null {
  const validation = validateRoutine(
    options.plan,
    options.request,
    options.catalog,
    options.safetyScreening,
  );
  if (!validation.valid) return null;

  const catalogById = new Map(
    options.catalog.map((exercise) => [exercise.id, exercise]),
  );
  const warnings = [
    ...new Set([
      ...options.plan.warnings,
      ...validation.warnings.map((warning) => warning.message),
    ]),
  ];

  return ValidatedPlanSummarySchema.parse({
    title: options.plan.title,
    goal: options.plan.goal,
    days: options.plan.days.map((day) => ({
      name: day.name,
      focus: day.focus,
      estimatedMinutes: day.estimatedMinutes,
      exercises: day.exercises.map((exercise) => ({
        exerciseId: exercise.exerciseId,
        displayName: exerciseName(exercise.exerciseId, catalogById),
        sets: exercise.sets,
        repPrescription: exercise.repPrescription,
        restSeconds: exercise.restSeconds,
        rir: exercise.rir,
        selectionReasons: exercise.selectionReasons,
      })),
    })),
    warnings,
    assumptions: options.plan.assumptions,
    validationSummary:
      validation.warnings.length === 0
        ? "El validador determinista no encontró errores ni advertencias."
        : `El validador determinista no encontró errores y registró ${validation.warnings.length} advertencia${validation.warnings.length === 1 ? "" : "s"}.`,
  });
}

/** Keeps the provider result structural while the application owns execution. */
export function readyModification(
  result: RoutineModificationResult,
): NonNullable<RoutineModificationResult["modification"]> | null {
  return result.status === "ready" ? result.modification : null;
}
