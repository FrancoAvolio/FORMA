import "server-only";

import type { AiProvider } from "@/ai/ai-provider";
import { getCloudflareAiBinding } from "@/ai/cloudflare-binding.server";
import { isAiProviderError, toAiFallbackState } from "@/ai/errors";
import { createAiProvider } from "@/ai/providers/provider-factory";
import { createFixedWindowRateLimiter } from "@/ai/request-rate-limiter";

const MAXIMUM_REQUEST_BYTES = 32_000;
const requestLimiter = createFixedWindowRateLimiter({
  // One conversational turn can legitimately use extraction plus grounded phrasing.
  maximumRequests: process.env.NODE_ENV === "production" ? 20 : 200,
  windowMs: 60_000,
});

export function clientKey(request: Request): string {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;
  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }
  return "anonymous";
}

export function rateLimitResponse(request: Request): Response | null {
  const decision = requestLimiter.check(clientKey(request));
  if (decision.allowed) return null;
  return Response.json(
    {
      ok: false,
      error: {
        code: "rate_limited",
        title: "Hay demasiadas solicitudes",
        message:
          "Esperá un momento. Tu conversación y tu rutina siguen guardadas.",
        action: "guided_form",
        canRetry: true,
      },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(decision.retryAfterSeconds),
      },
    },
  );
}

export async function readBoundedJson(
  request: Request,
): Promise<{ ok: true; payload: unknown } | { ok: false; response: Response }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAXIMUM_REQUEST_BYTES) {
    return {
      ok: false,
      response: invalidInputResponse("El mensaje es demasiado largo.", 413),
    };
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAXIMUM_REQUEST_BYTES) {
      return {
        ok: false,
        response: invalidInputResponse("El mensaje es demasiado largo.", 413),
      };
    }
    return { ok: true, payload: JSON.parse(text) as unknown };
  } catch {
    return {
      ok: false,
      response: invalidInputResponse("La solicitud no contiene JSON válido."),
    };
  }
}

export function invalidInputResponse(message: string, status = 400): Response {
  return Response.json(
    { ok: false, error: { code: "invalid_input", message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function createConfiguredProvider(): Promise<AiProvider> {
  const configuredProvider =
    process.env.AI_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "cloudflare" : "ollama");
  const cloudflareBinding =
    configuredProvider === "cloudflare" ? await getCloudflareAiBinding() : null;
  return createAiProvider({ environment: process.env, cloudflareBinding });
}

export function aiFailureResponse(error: unknown, provider: AiProvider): Response {
  const fallback = toAiFallbackState(error);
  const status =
    fallback.code === "invalid_input"
      ? 400
      : fallback.code === "quota_exhausted" || fallback.code === "rate_limited"
        ? 429
        : fallback.code === "aborted"
          ? 499
          : 503;
  return Response.json(
    {
      ok: false,
      ...(process.env.NODE_ENV === "development"
        ? { diagnostics: { provider: provider.id, model: provider.model } }
        : {}),
      error: fallback,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(isAiProviderError(error) && error.retryAfterSeconds
          ? { "Retry-After": String(error.retryAfterSeconds) }
          : {}),
      },
    },
  );
}

export function successResponse(payload: Record<string, unknown>): Response {
  return Response.json(
    { ok: true, ...payload },
    { headers: { "Cache-Control": "no-store" } },
  );
}
