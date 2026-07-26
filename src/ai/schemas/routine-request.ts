import { z } from "zod";

import {
  ExperienceLevelSchema,
  RoutineGoalSchema,
  RoutineRequestSchema,
  TrainingLocationSchema,
  type RoutineRequest,
} from "../../domain/profile/routine-request";
import { AI_LIMITS } from "../limits";
import {
  BoundedTextListSchema,
  BoundedTextSchema,
  LocaleSchema,
  UserMessageSchema,
} from "./common";
import type { AiRequestControls } from "./common";
import { SafetySignalsListSchema } from "./safety";

export const REQUIRED_ROUTINE_FIELD_VALUES = [
  "goal",
  "experience",
  "daysPerWeek",
  "sessionMinutes",
  "trainingLocationOrEquipment",
  "limitationsConfirmation",
] as const;

export const RequiredRoutineFieldSchema = z.enum(
  REQUIRED_ROUTINE_FIELD_VALUES,
);

export const LIMITATIONS_CONFIRMATION_VALUES = [
  "not_confirmed",
  "confirmed_none",
  "confirmed_with_limitations",
] as const;

export const LimitationsConfirmationSchema = z.enum(
  LIMITATIONS_CONFIRMATION_VALUES,
);

/**
 * The draft is deliberately explicit: every key must be returned and unknown
 * keys fail validation. Null represents information the user has not supplied.
 */
export const RoutineRequestDraftSchema = z
  .object({
    goal: RoutineGoalSchema.nullable(),
    experience: ExperienceLevelSchema.nullable(),
    daysPerWeek: RoutineRequestSchema.shape.daysPerWeek.nullable(),
    sessionMinutes: RoutineRequestSchema.shape.sessionMinutes.nullable(),
    trainingLocation: TrainingLocationSchema.nullable(),
    availableEquipment: BoundedTextListSchema,
    focusMuscles: BoundedTextListSchema,
    excludedExercises: BoundedTextListSchema,
    excludedMovementPatterns:
      RoutineRequestSchema.shape.excludedMovementPatterns,
    preferredExercises: BoundedTextListSchema,
    limitations: BoundedTextListSchema,
    notes: z.string().trim().max(AI_LIMITS.notesCharacters).nullable(),
  })
  .strict();

export type RoutineRequestDraft = z.output<typeof RoutineRequestDraftSchema>;

export const ParseRoutineInputDataSchema = z
  .object({
    message: UserMessageSchema,
    currentDraft: RoutineRequestDraftSchema.optional(),
    currentLimitationsConfirmation: LimitationsConfirmationSchema.default(
      "not_confirmed",
    ),
    locale: LocaleSchema,
  })
  .strict();

export type ParseRoutineInput = z.input<typeof ParseRoutineInputDataSchema> &
  AiRequestControls;

export const ParseRoutineResultSchema = z
  .object({
    status: z.enum(["complete", "needs_input", "unsupported"]),
    request: RoutineRequestDraftSchema,
    limitationsConfirmation: LimitationsConfirmationSchema,
    missingFields: z.array(RequiredRoutineFieldSchema).max(6),
    assumptions: z.array(BoundedTextSchema).max(12),
    safetySignals: SafetySignalsListSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.missingFields).size !== value.missingFields.length) {
      context.addIssue({
        code: "custom",
        path: ["missingFields"],
        message: "missingFields no admite duplicados.",
      });
    }

    const requestCandidate = {
      ...value.request,
      goal: value.request.goal ?? undefined,
      experience: value.request.experience ?? undefined,
      daysPerWeek: value.request.daysPerWeek ?? undefined,
      sessionMinutes: value.request.sessionMinutes ?? undefined,
      trainingLocation: value.request.trainingLocation ?? undefined,
    };
    const requestIsComplete = RoutineRequestSchema.safeParse(requestCandidate).success;
    const confirmationIsComplete =
      value.limitationsConfirmation !== "not_confirmed";

    if (value.status !== "unsupported") {
      const derivedMissing: (typeof REQUIRED_ROUTINE_FIELD_VALUES)[number][] = [];
      if (value.request.goal === null) derivedMissing.push("goal");
      if (value.request.experience === null) derivedMissing.push("experience");
      if (value.request.daysPerWeek === null) derivedMissing.push("daysPerWeek");
      if (value.request.sessionMinutes === null) {
        derivedMissing.push("sessionMinutes");
      }
      if (
        value.request.trainingLocation === null &&
        value.request.availableEquipment.length === 0
      ) {
        derivedMissing.push("trainingLocationOrEquipment");
      }
      if (!confirmationIsComplete) {
        derivedMissing.push("limitationsConfirmation");
      }
      for (const missingField of derivedMissing) {
        if (!value.missingFields.includes(missingField)) {
          context.addIssue({
            code: "custom",
            path: ["missingFields"],
            message: `Falta declarar el campo requerido: ${missingField}.`,
          });
        }
      }
    }

    if (value.status === "complete") {
      if (value.missingFields.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["missingFields"],
          message: "Una solicitud completa no puede tener campos faltantes.",
        });
      }
      if (!requestIsComplete || !confirmationIsComplete) {
        context.addIssue({
          code: "custom",
          path: ["status"],
          message:
            "complete requiere un RoutineRequest válido y confirmación de limitaciones.",
        });
      }
    }

    if (value.status === "needs_input" && value.missingFields.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["missingFields"],
        message: "needs_input requiere al menos un campo faltante.",
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

export type ParseRoutineResult = z.output<typeof ParseRoutineResultSchema>;

export function toCompleteRoutineRequest(
  result: ParseRoutineResult,
): RoutineRequest | null {
  if (
    result.status !== "complete" ||
    result.limitationsConfirmation === "not_confirmed"
  ) {
    return null;
  }

  const candidate = {
    ...result.request,
    goal: result.request.goal ?? undefined,
    experience: result.request.experience ?? undefined,
    daysPerWeek: result.request.daysPerWeek ?? undefined,
    sessionMinutes: result.request.sessionMinutes ?? undefined,
    trainingLocation: result.request.trainingLocation ?? undefined,
  };

  const parsed = RoutineRequestSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
