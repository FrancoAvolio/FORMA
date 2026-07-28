import { z } from "zod";

import { GroundedExerciseResponseContextSchema } from "@/ai/schemas/assistant-response";
import { resolveGroundedExerciseContext } from "@/application/conversation/grounded-exercise-context";
import { RoutineRequestSchema } from "@/domain/profile/routine-request";
import { RoutinePlanSchema } from "@/domain/routine/schemas";

import {
  invalidInputResponse,
  rateLimitResponse,
  readBoundedJson,
  successResponse,
} from "../_shared";

export const dynamic = "force-dynamic";

const ExerciseQuestionRequestSchema = z
  .object({
    questionKind: z.enum([
      "overview",
      "muscles",
      "instructions",
      "selection_reason",
      "alternatives",
    ]),
    target: z
      .object({
        exerciseId: z.string().trim().min(1).max(64),
        dayId: z.string().trim().min(1).max(160).optional(),
      })
      .strict(),
    routinePlan: RoutinePlanSchema,
    routineRequest: RoutineRequestSchema,
    requiredAlternativeEquipment: z
      .array(z.string().trim().min(1).max(120))
      .max(4)
      .default([]),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const body = await readBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = ExerciseQuestionRequestSchema.safeParse(body.payload);
  if (!parsed.success) {
    return invalidInputResponse(
      "La pregunta no identifica un ejercicio válido de la rutina actual.",
    );
  }

  const result =
    parsed.data.questionKind === "alternatives"
      ? resolveGroundedExerciseContext({
          questionKind: "alternatives",
          target: parsed.data.target,
          routinePlan: parsed.data.routinePlan,
          routineRequest: parsed.data.routineRequest,
          requiredAlternativeEquipment:
            parsed.data.requiredAlternativeEquipment,
        })
      : resolveGroundedExerciseContext({
          questionKind: parsed.data.questionKind,
          target: parsed.data.target,
          routinePlan: parsed.data.routinePlan,
        });
  if (!result.ok) {
    return invalidInputResponse(result.message);
  }

  const exercise = result.context.exercise;
  const responseContext = GroundedExerciseResponseContextSchema.parse({
    exerciseId: exercise.id,
    displayName: exercise.displayNameEs ?? exercise.displayName,
    primaryTarget: exercise.primaryMuscles[0] ?? exercise.bodyPart,
    secondaryMuscles: exercise.secondaryMuscles,
    equipment: exercise.requiredEquipment,
    instructions:
      exercise.instructionStepsEs.length > 0
        ? exercise.instructionStepsEs
        : [exercise.instructionsEs].filter((instruction) => instruction.trim()),
    selectionReasons: result.context.routine?.selectionReasons ?? [],
    approvedAlternatives: result.context.alternatives.map((alternative) => ({
      exerciseId: alternative.id,
      displayName: alternative.displayNameEs ?? alternative.displayName,
    })),
  });

  return successResponse({ context: result.context, responseContext });
}
