import {
  ParsedRoutineTurnSchema,
  ParseRoutineTurnInputDataSchema,
} from "@/ai/schemas/routine-request";
import {
  detectDeterministicSafetySignals,
  reconcileParsedTurnSafety,
} from "@/application/conversation/deterministic-safety";
import { isClearlyOffTopicMessage } from "@/application/conversation/domain-relevance";
import { normalizeDomainText } from "@/domain/exercises/normalization";

import {
  aiFailureResponse,
  createConfiguredProvider,
  invalidInputResponse,
  rateLimitResponse,
  readBoundedJson,
  successResponse,
} from "../_shared";

export const dynamic = "force-dynamic";

function isGreetingOnly(message: string): boolean {
  return /^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|holi)( bro| forma)?$/u.test(
    normalizeDomainText(message),
  );
}

export async function POST(request: Request): Promise<Response> {
  const limited = rateLimitResponse(request);
  if (limited) return limited;

  const body = await readBoundedJson(request);
  if (!body.ok) return body.response;
  const parsed = ParseRoutineTurnInputDataSchema.safeParse(body.payload);
  if (!parsed.success) {
    return invalidInputResponse(
      "El mensaje o el perfil actual no respetan el contrato de conversación.",
    );
  }

  const deterministicSignals = detectDeterministicSafetySignals(
    parsed.data.message,
  );
  if (isGreetingOnly(parsed.data.message)) {
    return successResponse({
      turn: ParsedRoutineTurnSchema.parse({
        intent: "greeting",
        requestPatch: {},
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      }),
    });
  }
  if (deterministicSignals.length > 0) {
    return successResponse({
      turn: ParsedRoutineTurnSchema.parse({
        intent: "unsupported",
        requestPatch: {},
        limitationsConfirmation: "has_limitations",
        safetySignals: deterministicSignals,
        assumptions: [],
      }),
    });
  }
  if (isClearlyOffTopicMessage(parsed.data.message)) {
    return successResponse({
      turn: ParsedRoutineTurnSchema.parse({
        intent: "off_topic",
        requestPatch: {},
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      }),
    });
  }

  const provider = await createConfiguredProvider();
  try {
    const extracted = await provider.parseRoutineTurn({
      message: parsed.data.message,
      locale: parsed.data.locale,
      signal: request.signal,
    });
    const turn = reconcileParsedTurnSafety(extracted, parsed.data.message);

    // Advisory model classification can only add caution. The reconciled turn
    // already blocks generation and remains authoritative if this second call fails.
    if (turn.safetySignals.length > 0) {
      try {
        await provider.classifySafety({
          message: parsed.data.message,
          declaredLimitations: turn.requestPatch.limitations ?? [],
          deterministicSignals: turn.safetySignals,
          locale: parsed.data.locale,
          signal: request.signal,
        });
      } catch {
        // Fail closed with the validated signals already present.
      }
    }

    return successResponse({
      turn,
      ...(process.env.NODE_ENV === "development"
        ? { diagnostics: { provider: provider.id, model: provider.model } }
        : {}),
    });
  } catch (error) {
    return aiFailureResponse(error, provider);
  }
}
