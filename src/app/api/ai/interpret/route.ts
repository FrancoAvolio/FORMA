import { createAiProvider } from "@/ai/providers/provider-factory";
import { getCloudflareAiBinding } from "@/ai/cloudflare-binding.server";
import { isAiProviderError, toAiFallbackState } from "@/ai/errors";
import { ParseRoutineInputDataSchema } from "@/ai/schemas/routine-request";
import { createFixedWindowRateLimiter } from "@/ai/request-rate-limiter";

export const dynamic = "force-dynamic";

const MAXIMUM_REQUEST_BYTES = 32_000;
const requestLimiter = createFixedWindowRateLimiter({
  maximumRequests: 10,
  windowMs: 60_000,
});

function clientKey(request: Request): string {
  const cloudflareAddress = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareAddress) return cloudflareAddress;
  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }
  return "anonymous";
}

export async function POST(request: Request): Promise<Response> {
  const rateLimit = requestLimiter.check(clientKey(request));
  if (!rateLimit.allowed) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "rate_limited",
          title: "Demasiados intentos seguidos",
          message: "Esperá un momento o continuá con el formulario guiado.",
          action: "guided_form",
          canRetry: true,
        },
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAXIMUM_REQUEST_BYTES) {
    return Response.json(
      { ok: false, error: { code: "invalid_input", message: "El mensaje es demasiado largo." } },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAXIMUM_REQUEST_BYTES) {
      return Response.json(
        {
          ok: false,
          error: { code: "invalid_input", message: "El mensaje es demasiado largo." },
        },
        { status: 413 },
      );
    }
    payload = JSON.parse(text);
  } catch {
    return Response.json(
      { ok: false, error: { code: "invalid_input", message: "Solicitud inválida." } },
      { status: 400 },
    );
  }

  const parsed = ParseRoutineInputDataSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: "invalid_input",
          message: "El mensaje o el perfil parcial no respetan el contrato.",
        },
      },
      { status: 400 },
    );
  }

  const configuredProvider =
    process.env.AI_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "cloudflare" : "ollama");
  const cloudflareBinding =
    configuredProvider === "cloudflare" ? await getCloudflareAiBinding() : null;
  const provider = createAiProvider({
    environment: process.env,
    cloudflareBinding,
  });

  try {
    const result = await provider.parseRoutineRequest(parsed.data);
    return Response.json(
      {
        ok: true,
        provider: { id: provider.id, model: provider.model },
        result,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const fallback = toAiFallbackState(error);
    const status =
      fallback.code === "invalid_input"
        ? 400
        : fallback.code === "quota_exhausted" || fallback.code === "rate_limited"
          ? 429
          : 503;
    return Response.json(
      {
        ok: false,
        provider: { id: provider.id, model: provider.model },
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
}
