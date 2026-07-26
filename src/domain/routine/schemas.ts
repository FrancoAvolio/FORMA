import { z } from "zod";

import { RoutineGoalSchema } from "../profile/routine-request";

export const RoutineExerciseSchema = z.object({
  exerciseId: z.string().trim().min(1).max(128),
  sets: z.number().int().min(1).max(6),
  repPrescription: z
    .string()
    .trim()
    .regex(/^\d+\s*[\u2013-]\s*\d+$/, "Use a numeric repetition range."),
  restSeconds: z.number().int().min(30).max(300),
  rir: z.number().int().min(0).max(5).nullable(),
  tempo: z.string().trim().min(1).max(40).nullable(),
  notes: z.array(z.string().trim().min(1).max(300)).max(16),
  selectionReasons: z.array(z.string().trim().min(1).max(300)).min(1).max(16),
});

export const RoutineDaySchema = z.object({
  id: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(160),
  focus: z.array(z.string().trim().min(1).max(120)).min(1).max(16),
  estimatedMinutes: z.number().int().min(1).max(180),
  exercises: z.array(RoutineExerciseSchema).min(1).max(12),
});

export const RoutinePlanSchema = z.object({
  id: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  goal: RoutineGoalSchema,
  daysPerWeek: z.number().int().min(1).max(6),
  summary: z.string().trim().min(1).max(1_000),
  splitId: z.string().trim().min(1).max(160),
  splitName: z.string().trim().min(1).max(160),
  days: z.array(RoutineDaySchema).min(1).max(6),
  warnings: z.array(z.string().trim().min(1).max(500)).max(32),
  assumptions: z.array(z.string().trim().min(1).max(500)).max(32),
  generatedAt: z.string().datetime({ offset: true }),
  engineVersion: z.string().trim().min(1).max(80),
  datasetVersion: z.string().trim().min(1).max(160),
  seed: z.string().trim().min(1).max(256),
});

export type RoutineExercise = z.infer<typeof RoutineExerciseSchema>;
export type RoutineDay = z.infer<typeof RoutineDaySchema>;
export type RoutinePlan = z.infer<typeof RoutinePlanSchema>;
