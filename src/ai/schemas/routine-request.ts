import { z } from "zod";

import {
  LimitationsConfirmationSchema,
  RequiredRoutineFieldSchema,
  RoutineRequestDraftSchema,
  type LimitationsConfirmation,
  type RequiredRoutineField,
  type RoutineRequestDraft,
} from "../../domain/profile/routine-draft";
import {
  ExperienceLevelSchema,
  RoutineGoalSchema,
  RoutineRequestSchema,
  TrainingLocationSchema,
} from "../../domain/profile/routine-request";
import { BoundedTextSchema, LocaleSchema, UserMessageSchema } from "./common";
import type { AiRequestControls } from "./common";
import { SafetySignalsListSchema } from "./safety";

export {
  LimitationsConfirmationSchema,
  RequiredRoutineFieldSchema,
  RoutineRequestDraftSchema,
};
export type {
  LimitationsConfirmation,
  RequiredRoutineField,
  RoutineRequestDraft,
};

export const ROUTINE_TURN_INTENT_VALUES = [
  "greeting",
  "provide_information",
  "modify_profile",
  "modify_routine",
  "ask_question",
  "unsupported",
  "other",
] as const;

export const RoutineTurnIntentSchema = z.enum(ROUTINE_TURN_INTENT_VALUES);
export type RoutineTurnIntent = z.output<typeof RoutineTurnIntentSchema>;

export const LATEST_TURN_LIMITATIONS_CONFIRMATION_VALUES = [
  "unknown",
  "no_limitations",
  "has_limitations",
] as const;

/**
 * This enum describes only what was explicitly said in the latest turn. It is
 * intentionally separate from the canonical confirmation stored by the app.
 */
export const LatestTurnLimitationsConfirmationSchema = z.enum(
  LATEST_TURN_LIMITATIONS_CONFIRMATION_VALUES,
);

export type LatestTurnLimitationsConfirmation = z.output<
  typeof LatestTurnLimitationsConfirmationSchema
>;

const UniqueEquipmentListSchema = RoutineRequestSchema.shape.availableEquipment
  .max(32)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        message: "Los valores de equipamiento no pueden repetirse.",
      });
    }
  });

const UniquePreferenceListSchema = z
  .array(BoundedTextSchema)
  .max(48)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        message: "Los valores de la lista no pueden repetirse.",
      });
    }
  });

const UniqueMovementPatternListSchema =
  RoutineRequestSchema.shape.excludedMovementPatterns.superRefine(
    (values, context) => {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: "custom",
          message: "Los patrones de movimiento no pueden repetirse.",
        });
      }
    },
  );

/**
 * A latest-turn delta. Missing keys mean "not mentioned"; null means the user
 * explicitly cleared that value. Empty patches are valid for greetings and
 * questions.
 */
export const RoutineRequestPatchSchema = z
  .object({
    goal: RoutineGoalSchema.nullable(),
    experience: ExperienceLevelSchema.nullable(),
    daysPerWeek: RoutineRequestSchema.shape.daysPerWeek.nullable(),
    sessionMinutes: RoutineRequestSchema.shape.sessionMinutes.nullable(),
    trainingLocation: TrainingLocationSchema.nullable(),
    availableEquipment: UniqueEquipmentListSchema.nullable(),
    focusMuscles: UniquePreferenceListSchema.nullable(),
    excludedExercises: UniquePreferenceListSchema.nullable(),
    excludedMovementPatterns: UniqueMovementPatternListSchema.nullable(),
    preferredExercises: UniquePreferenceListSchema.nullable(),
    limitations: UniquePreferenceListSchema.nullable(),
    notes: RoutineRequestSchema.shape.notes,
  })
  .partial()
  .strict();

export type RoutineRequestPatch = z.output<typeof RoutineRequestPatchSchema>;

export const ParseRoutineTurnInputDataSchema = z
  .object({
    message: UserMessageSchema,
    currentDraft: RoutineRequestDraftSchema.optional(),
    currentLimitationsConfirmation: LimitationsConfirmationSchema.default(
      "not_confirmed",
    ),
    locale: LocaleSchema,
  })
  .strict();

export type ParseRoutineTurnInput = z.input<
  typeof ParseRoutineTurnInputDataSchema
> &
  AiRequestControls;

/**
 * Hostile model output. It contains latest-turn extraction only: no derived
 * completeness, missing fields, safety eligibility, or routine validity.
 */
export const ParsedRoutineTurnSchema = z
  .object({
    intent: RoutineTurnIntentSchema,
    requestPatch: RoutineRequestPatchSchema,
    limitationsConfirmation: LatestTurnLimitationsConfirmationSchema,
    safetySignals: SafetySignalsListSchema,
    assumptions: z.array(BoundedTextSchema).max(12),
  })
  .strict();

export type ParsedRoutineTurn = z.output<typeof ParsedRoutineTurnSchema>;

/** Input aliases retained while callers migrate to the clearer turn naming. */
export const ParseRoutineInputDataSchema = ParseRoutineTurnInputDataSchema;
export type ParseRoutineInput = ParseRoutineTurnInput;
