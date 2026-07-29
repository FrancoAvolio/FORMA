import {
  ParseRoutineModificationInputDataSchema,
  RoutineModificationResultSchema,
} from "@/ai/schemas/routine-modification";
import { detectDeterministicSafetySignals } from "@/application/conversation/deterministic-safety";
import {
  isClearlyOffTopicMessage,
  OFF_TOPIC_REPLY,
} from "@/application/conversation/domain-relevance";

import {
  aiFailureResponse,
  createConfiguredProvider,
  invalidInputResponse,
  rateLimitResponse,
  readBoundedJson,
  successResponse,
} from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const body = await readBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = ParseRoutineModificationInputDataSchema.safeParse(body.payload);
  if (!parsed.success) {
    return invalidInputResponse(
      "El cambio solicitado o el contexto de la rutina son inválidos.",
    );
  }

  const deterministicSignals = detectDeterministicSafetySignals(
    parsed.data.message,
  );
  if (deterministicSignals.length > 0) {
    return successResponse({
      result: RoutineModificationResultSchema.parse({
        status: "unsupported",
        modification: null,
        clarificationQuestion: null,
        safetySignals: deterministicSignals,
        assumptions: [],
      }),
    });
  }
  if (isClearlyOffTopicMessage(parsed.data.message)) {
    return successResponse({
      result: RoutineModificationResultSchema.parse({
        status: "needs_clarification",
        modification: null,
        clarificationQuestion: OFF_TOPIC_REPLY,
        safetySignals: [],
        assumptions: [],
      }),
    });
  }

  const provider = await createConfiguredProvider();
  try {
    const result = await provider.parseRoutineModification({
      ...parsed.data,
      signal: request.signal,
    });
    return successResponse({ result });
  } catch (error) {
    return aiFailureResponse(error, provider);
  }
}
