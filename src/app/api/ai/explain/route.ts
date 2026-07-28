import { toAiFallbackState } from "@/ai/errors";
import { ExplainPlanInputDataSchema } from "@/ai/schemas/explanation";
import { detectDeterministicSafetySignals } from "@/application/conversation/deterministic-safety";
import type { z } from "zod";

import {
  createConfiguredProvider,
  invalidInputResponse,
  rateLimitResponse,
  readBoundedJson,
  successResponse,
} from "../_shared";

export const dynamic = "force-dynamic";

function deterministicExplanation(
  input: z.output<typeof ExplainPlanInputDataSchema>,
): string {
  const exerciseCount = input.plan.days.reduce(
    (total, day) => total + day.exercises.length,
    0,
  );
  const firstReason = input.plan.days
    .flatMap((day) => day.exercises)
    .flatMap((exercise) => exercise.selectionReasons)[0];
  return `${input.plan.title} contiene ${input.plan.days.length} días y ${exerciseCount} ejercicios del catálogo validado. ${input.plan.validationSummary}${firstReason ? ` Una de las razones registradas por el motor es: ${firstReason}` : ""}`;
}

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const body = await readBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = ExplainPlanInputDataSchema.safeParse(body.payload);
  if (!parsed.success) {
    return invalidInputResponse("El resumen validado de la rutina es inválido.");
  }
  if (
    parsed.data.question &&
    detectDeterministicSafetySignals(parsed.data.question).length > 0
  ) {
    return invalidInputResponse(
      "FORMA no puede convertir una explicación de rutina en orientación médica.",
    );
  }

  const provider = await createConfiguredProvider();
  try {
    const explanation = await provider.explainPlan({
      ...parsed.data,
      signal: request.signal,
    });
    return successResponse({ explanation, fallbackUsed: false });
  } catch (error) {
    return successResponse({
      explanation: deterministicExplanation(parsed.data),
      fallbackUsed: true,
      providerError: toAiFallbackState(error),
    });
  }
}
