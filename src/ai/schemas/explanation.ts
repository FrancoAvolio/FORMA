import { z } from "zod";

import { RoutineGoalSchema } from "../../domain/profile/routine-request";
import { AI_LIMITS } from "../limits";
import { BoundedTextListSchema, LocaleSchema } from "./common";
import type { AiRequestControls } from "./common";

const ExplainExerciseSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(160),
    sets: z.number().int().min(1).max(12),
    repPrescription: z.string().trim().min(1).max(80),
    restSeconds: z.number().int().min(0).max(600),
    rir: z.number().int().min(0).max(5).nullable(),
    selectionReasons: BoundedTextListSchema,
  })
  .strict();

const ExplainDaySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    focus: BoundedTextListSchema,
    estimatedMinutes: z.number().int().min(1).max(240),
    exercises: z.array(ExplainExerciseSchema).max(AI_LIMITS.exercisesPerDay),
  })
  .strict();

export const ValidatedPlanSummarySchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    goal: RoutineGoalSchema,
    days: z.array(ExplainDaySchema).min(1).max(AI_LIMITS.planDays),
    warnings: BoundedTextListSchema,
    assumptions: BoundedTextListSchema,
    validationSummary: z.string().trim().min(1).max(500),
  })
  .strict();

export const ExplainPlanInputDataSchema = z
  .object({
    plan: ValidatedPlanSummarySchema,
    question: z.string().trim().min(1).max(1_000).nullable().default(null),
    locale: LocaleSchema,
  })
  .strict();

export type ExplainPlanInput = z.input<typeof ExplainPlanInputDataSchema> &
  AiRequestControls;

export const ExplainPlanResultSchema = z
  .object({
    explanation: z
      .string()
      .trim()
      .min(1)
      .max(AI_LIMITS.explanationCharacters),
  })
  .strict();

export type ExplainPlanResult = z.output<typeof ExplainPlanResultSchema>;

