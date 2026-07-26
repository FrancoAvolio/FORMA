import { z } from "zod";

import { MovementPatternSchema } from "../exercises/catalog-exercise";

export const RoutineGoalSchema = z.enum([
  "hypertrophy",
  "strength",
  "general_fitness",
  "muscular_endurance",
]);

export const ExperienceLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const TrainingLocationSchema = z.enum([
  "commercial_gym",
  "home",
  "custom",
]);

const ConstraintListSchema = z
  .array(z.string().trim().min(1).max(240))
  .max(64);

/** A complete, generation-ready request. Partial conversational state lives outside the domain engine. */
export const RoutineRequestSchema = z.object({
  goal: RoutineGoalSchema,
  experience: ExperienceLevelSchema,
  daysPerWeek: z.number().int().min(1).max(6),
  sessionMinutes: z.number().int().min(20).max(120),
  trainingLocation: TrainingLocationSchema,
  availableEquipment: z
    .array(z.string().trim().min(1).max(120))
    .max(32),
  focusMuscles: ConstraintListSchema,
  excludedExercises: ConstraintListSchema,
  excludedMovementPatterns: z.array(MovementPatternSchema).max(11),
  preferredExercises: ConstraintListSchema,
  limitations: ConstraintListSchema,
  notes: z.string().trim().max(1_000).nullable(),
});

export type RoutineGoal = z.infer<typeof RoutineGoalSchema>;
export type ExperienceLevel = z.infer<typeof ExperienceLevelSchema>;
export type TrainingLocation = z.infer<typeof TrainingLocationSchema>;
export type RoutineRequest = z.infer<typeof RoutineRequestSchema>;
