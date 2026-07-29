import { toAiFallbackState } from "@/ai/errors";
import { ComposeAssistantResponseInputDataSchema } from "@/ai/schemas/assistant-response";
import {
  composeAssistantFallback,
  OFF_TOPIC_REPLY,
} from "@/application/conversation";

import {
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
  const context = ComposeAssistantResponseInputDataSchema.safeParse(body.payload);
  if (!context.success) {
    return invalidInputResponse(
      "El contexto validado de la respuesta conversacional es inválido.",
    );
  }

  if (context.data.latestIntent === "off_topic") {
    return successResponse({
      response: { message: OFF_TOPIC_REPLY },
      fallbackUsed: true,
    });
  }

  const provider = await createConfiguredProvider();
  try {
    const response = await provider.composeAssistantResponse({
      ...context.data,
      signal: request.signal,
    });
    return successResponse({ response, fallbackUsed: false });
  } catch (error) {
    return successResponse({
      response: { message: composeAssistantFallback(context.data) },
      fallbackUsed: true,
      providerError: toAiFallbackState(error),
    });
  }
}
