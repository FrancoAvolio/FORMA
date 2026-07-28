import { z } from "zod";

import { RoutineRequestSchema } from "../../domain/profile/routine-request";
import { AI_LIMITS } from "../limits";
import {
  BoundedTextListSchema,
  BoundedTextSchema,
  LocaleSchema,
  UserMessageSchema,
} from "./common";
import type { AiRequestControls } from "./common";
import { SafetySignalsListSchema } from "./safety";

export const PlanExerciseContextSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(160),
  })
  .strict();

export const PlanDayContextSchema = z
  .object({
    dayId: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(120),
    exercises: z
      .array(PlanExerciseContextSchema)
      .max(AI_LIMITS.exercisesPerDay),
  })
  .strict();

export const RoutinePlanContextSchema = z
  .object({
    routineId: z.string().trim().min(1).max(96),
    days: z.array(PlanDayContextSchema).min(1).max(AI_LIMITS.planDays),
  })
  .strict()
  .superRefine((plan, context) => {
    const dayIds = plan.days.map((day) => day.dayId);
    if (new Set(dayIds).size !== dayIds.length) {
      context.addIssue({
        code: "custom",
        path: ["days"],
        message: "Los IDs de día deben ser únicos.",
      });
    }
    plan.days.forEach((day, dayIndex) => {
      const exerciseIds = day.exercises.map((exercise) => exercise.exerciseId);
      if (new Set(exerciseIds).size !== exerciseIds.length) {
        context.addIssue({
          code: "custom",
          path: ["days", dayIndex, "exercises"],
          message: "Un día no puede repetir el mismo exerciseId.",
        });
      }
    });
  });

export const ParseRoutineModificationInputDataSchema = z
  .object({
    message: UserMessageSchema,
    currentRequest: RoutineRequestSchema.strict(),
    plan: RoutinePlanContextSchema,
    locale: LocaleSchema,
  })
  .strict();

export type ParseRoutineModificationInput = z.input<
  typeof ParseRoutineModificationInputDataSchema
> &
  AiRequestControls;

const UpdateRequestModificationSchema = z
  .object({
    kind: z.literal("update_request"),
    patch: RoutineRequestSchema.strict().partial().refine(
      (patch) => Object.keys(patch).length > 0,
      "El cambio debe incluir al menos un campo.",
    ),
  })
  .strict();

const ReplaceExerciseModificationSchema = z
  .object({
    kind: z.literal("replace_exercise"),
    dayId: z.string().trim().min(1).max(64),
    exerciseId: z.string().trim().min(1).max(64),
    requestedAlternative: z.string().trim().min(1).max(160).nullable(),
  })
  .strict();

const RemoveExerciseModificationSchema = z
  .object({
    kind: z.literal("remove_exercise"),
    dayId: z.string().trim().min(1).max(64),
    exerciseId: z.string().trim().min(1).max(64),
  })
  .strict();

const ReorderExerciseModificationSchema = z
  .object({
    kind: z.literal("reorder_exercise"),
    dayId: z.string().trim().min(1).max(64),
    exerciseId: z.string().trim().min(1).max(64),
    targetPosition: z.number().int().min(0).max(AI_LIMITS.exercisesPerDay - 1),
  })
  .strict();

const RegenerateDayModificationSchema = z
  .object({
    kind: z.literal("regenerate_day"),
    dayId: z.string().trim().min(1).max(64),
  })
  .strict();

const ShortenDayModificationSchema = z
  .object({
    kind: z.literal("shorten_day"),
    dayId: z.string().trim().min(1).max(64),
    targetMinutes: z.number().int().min(10).max(120).nullable(),
  })
  .strict();

const ExcludeEquipmentModificationSchema = z
  .object({
    kind: z.literal("exclude_equipment"),
    equipment: z
      .array(z.string().trim().min(1).max(120))
      .min(1)
      .max(4)
      .refine(
        (items) => new Set(items).size === items.length,
        "El equipamiento excluido no puede repetirse.",
      ),
  })
  .strict();

export const RoutineModificationSchema = z.discriminatedUnion("kind", [
  UpdateRequestModificationSchema,
  ReplaceExerciseModificationSchema,
  RemoveExerciseModificationSchema,
  ReorderExerciseModificationSchema,
  RegenerateDayModificationSchema,
  ShortenDayModificationSchema,
  ExcludeEquipmentModificationSchema,
]);

export const RoutineModificationResultSchema = z
  .object({
    status: z.enum(["ready", "needs_clarification", "unsupported"]),
    modification: RoutineModificationSchema.nullable(),
    clarificationQuestion: z.string().trim().min(1).max(300).nullable(),
    safetySignals: SafetySignalsListSchema,
    assumptions: z.array(BoundedTextSchema).max(12),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "ready" && value.modification === null) {
      context.addIssue({
        code: "custom",
        path: ["modification"],
        message: "ready requiere una modificación.",
      });
    }
    if (value.status !== "ready" && value.modification !== null) {
      context.addIssue({
        code: "custom",
        path: ["modification"],
        message: "Sólo ready puede incluir una modificación.",
      });
    }
    if (
      value.status === "needs_clarification" &&
      value.clarificationQuestion === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["clarificationQuestion"],
        message: "needs_clarification requiere una pregunta.",
      });
    }
    if (
      value.status !== "needs_clarification" &&
      value.clarificationQuestion !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["clarificationQuestion"],
        message: "Sólo needs_clarification puede incluir una pregunta.",
      });
    }
    if (value.status === "unsupported" && value.safetySignals.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["safetySignals"],
        message: "unsupported requiere una señal de seguridad.",
      });
    }
  });

export type RoutineModificationResult = z.output<
  typeof RoutineModificationResultSchema
>;

export function createRoutineModificationResultSchema(
  input: z.output<typeof ParseRoutineModificationInputDataSchema>,
) {
  const exercisePlacements = new Set(
    input.plan.days.flatMap((day) =>
      day.exercises.map(
        (exercise) => `${day.dayId}\u0000${exercise.exerciseId}`,
      ),
    ),
  );
  const dayIds = new Set(input.plan.days.map((day) => day.dayId));

  return RoutineModificationResultSchema.superRefine((value, context) => {
    const modification = value.modification;
    if (!modification) {
      return;
    }

    if (
      "exerciseId" in modification &&
      !exercisePlacements.has(
        `${modification.dayId}\u0000${modification.exerciseId}`,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["modification", "exerciseId"],
        message:
          "El modelo sólo puede referirse a una combinación de día y ejercicio presente en la rutina actual.",
      });
    }

    if (
      (modification.kind === "regenerate_day" ||
        modification.kind === "shorten_day") &&
      !dayIds.has(modification.dayId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["modification", "dayId"],
        message:
          "El modelo sólo puede referirse a días presentes en la rutina actual.",
      });
    }
  });
}

export const ModificationPromptContextSchema = z
  .object({
    request: RoutineRequestSchema.strict(),
    plan: RoutinePlanContextSchema,
    userMessage: UserMessageSchema,
    limitations: BoundedTextListSchema.optional(),
  })
  .strict();
