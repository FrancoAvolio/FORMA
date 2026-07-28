import { z } from "zod";

import {
  ExperienceLevelSchema,
  RoutineGoalSchema,
  RoutineRequestSchema,
  TrainingLocationSchema,
} from "./routine-request";

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

export type RequiredRoutineField = z.output<
  typeof RequiredRoutineFieldSchema
>;

export const LIMITATIONS_CONFIRMATION_VALUES = [
  "not_confirmed",
  "confirmed_none",
  "confirmed_with_limitations",
] as const;

/** Canonical application state, independent from any model's latest-turn output. */
export const LimitationsConfirmationSchema = z.enum(
  LIMITATIONS_CONFIRMATION_VALUES,
);

export type LimitationsConfirmation = z.output<
  typeof LimitationsConfirmationSchema
>;

/**
 * Editable routine-building state. Null means an essential scalar has not been
 * supplied; optional lists are represented by empty arrays so persistence and
 * form controls have one stable shape.
 */
export const RoutineRequestDraftSchema = z
  .object({
    goal: RoutineGoalSchema.nullable(),
    experience: ExperienceLevelSchema.nullable(),
    daysPerWeek: RoutineRequestSchema.shape.daysPerWeek.nullable(),
    sessionMinutes: RoutineRequestSchema.shape.sessionMinutes.nullable(),
    trainingLocation: TrainingLocationSchema.nullable(),
    availableEquipment: RoutineRequestSchema.shape.availableEquipment,
    focusMuscles: RoutineRequestSchema.shape.focusMuscles,
    excludedExercises: RoutineRequestSchema.shape.excludedExercises,
    excludedMovementPatterns:
      RoutineRequestSchema.shape.excludedMovementPatterns,
    preferredExercises: RoutineRequestSchema.shape.preferredExercises,
    limitations: RoutineRequestSchema.shape.limitations,
    notes: RoutineRequestSchema.shape.notes,
  })
  .strict();

export type RoutineRequestDraft = z.output<typeof RoutineRequestDraftSchema>;

export function createEmptyRoutineRequestDraft(): RoutineRequestDraft {
  return {
    goal: null,
    experience: null,
    daysPerWeek: null,
    sessionMinutes: null,
    trainingLocation: null,
    availableEquipment: [],
    focusMuscles: [],
    excludedExercises: [],
    excludedMovementPatterns: [],
    preferredExercises: [],
    limitations: [],
    notes: null,
  };
}
