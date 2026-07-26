import {
  ExerciseDifficultySchema,
  ExerciseLateralitySchema,
  ExerciseModalitySchema,
  MovementPatternSchema,
} from "@/domain/exercises";
import { z } from "zod";

const ExerciseIdSchema = z.string().regex(/^\d{4}$/u);
const NonEmptyTextSchema = z.string().trim().min(1);

export const ExerciseReviewStatusSchema = z.enum([
  "approved",
  "excluded",
  "unreviewed",
]);

export const ExerciseSummarySchema = z.strictObject({
  id: ExerciseIdSchema,
  sourceName: NonEmptyTextSchema,
  displayName: NonEmptyTextSchema,
  displayNameEs: NonEmptyTextSchema.nullable(),
  reviewStatus: ExerciseReviewStatusSchema,
  approvedForGeneration: z.boolean(),
  bodyPart: NonEmptyTextSchema,
  category: NonEmptyTextSchema,
  rawEquipment: NonEmptyTextSchema,
  equipment: NonEmptyTextSchema,
  requiredEquipment: z.array(NonEmptyTextSchema).min(1).max(8),
  primaryMuscles: z.array(NonEmptyTextSchema).min(1).max(12),
  secondaryMuscles: z.array(NonEmptyTextSchema).max(24),
  muscleGroup: NonEmptyTextSchema,
  difficulty: ExerciseDifficultySchema.nullable(),
  movementPattern: MovementPatternSchema.nullable(),
  modality: ExerciseModalitySchema.nullable(),
  laterality: ExerciseLateralitySchema.nullable(),
  aliases: z.array(NonEmptyTextSchema).max(32),
  mediaAvailable: z.boolean(),
  hasThumbnail: z.boolean(),
  hasAnimation: z.boolean(),
  mediaRef: ExerciseIdSchema.nullable(),
});

export const ExerciseDetailSchema = ExerciseSummarySchema.extend({
  instructionsEs: NonEmptyTextSchema,
  instructionStepsEs: z.array(NonEmptyTextSchema).min(1).max(64),
  sourceMedia: z
    .strictObject({
      thumbnailFilename: NonEmptyTextSchema,
      animationFilename: NonEmptyTextSchema,
      attribution: NonEmptyTextSchema,
      protectedMedia: z.literal(true),
      productionDistribution: z.literal("disabled_pending_license_review"),
    })
    .nullable(),
  sourceAttribution: NonEmptyTextSchema,
});

export type ExerciseReviewStatus = z.infer<typeof ExerciseReviewStatusSchema>;
export type ExerciseSummary = z.infer<typeof ExerciseSummarySchema>;
export type ExerciseDetail = z.infer<typeof ExerciseDetailSchema>;
