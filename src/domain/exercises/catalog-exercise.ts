import { z } from "zod";

export const MovementPatternSchema = z.enum([
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
  "cardio",
]);

export const ExerciseDifficultySchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
]);

export const ExerciseModalitySchema = z.enum(["compound", "isolation"]);
export const ExerciseLateralitySchema = z.enum(["bilateral", "unilateral"]);
export const ExerciseCostSchema = z.enum(["low", "medium", "high"]);

const OrderedRangeSchema = z
  .tuple([z.number().int().positive(), z.number().int().positive()])
  .refine(([minimum, maximum]) => minimum <= maximum, {
    message: "The range minimum must not exceed its maximum.",
  });

/**
 * Runtime boundary consumed by the routine engine.
 *
 * The data pipeline deliberately adapts its normalized/curated records into
 * this interface. The engine never imports a generated JSON catalog and does
 * not know where an exercise originated at runtime.
 */
export const CatalogExerciseSchema = z.object({
  id: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(240),
  sourceName: z.string().trim().min(1).max(240).optional(),
  aliases: z.array(z.string().trim().min(1).max(240)).max(32).default([]),
  bodyPart: z.string().trim().min(1).max(120),
  equipment: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
  primaryMuscles: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  secondaryMuscles: z.array(z.string().trim().min(1).max(120)).max(24),
  movementPattern: MovementPatternSchema,
  modality: ExerciseModalitySchema,
  laterality: ExerciseLateralitySchema,
  difficulty: ExerciseDifficultySchema,
  fatigueCost: ExerciseCostSchema,
  skillRequirement: ExerciseCostSchema,
  defaultRepRange: OrderedRangeSchema,
  defaultRestSeconds: OrderedRangeSchema,
  substitutionGroup: z.string().trim().min(1).max(160),
  tags: z.array(z.string().trim().min(1).max(120)).max(32),
  approvedForGeneration: z.boolean(),
});

export type MovementPattern = z.infer<typeof MovementPatternSchema>;
export type ExerciseDifficulty = z.infer<typeof ExerciseDifficultySchema>;
export type ExerciseModality = z.infer<typeof ExerciseModalitySchema>;
export type ExerciseLaterality = z.infer<typeof ExerciseLateralitySchema>;
export type ExerciseCost = z.infer<typeof ExerciseCostSchema>;
export type CatalogExercise = z.infer<typeof CatalogExerciseSchema>;

