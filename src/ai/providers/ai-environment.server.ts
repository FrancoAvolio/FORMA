import "server-only";

import { z } from "zod";

import { AI_PROVIDER_NAMES } from "../ai-provider";
import { AiProviderError } from "../errors";
import { AI_LIMITS } from "../limits";
import { CLOUDFLARE_STRUCTURED_MODES } from "./cloudflare-provider";

const OptionalNonemptyStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

function defaultProvider(environment: string | undefined) {
  return environment === "production" ? "cloudflare" : "ollama";
}

export const AiEnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    AI_PROVIDER: z.enum(AI_PROVIDER_NAMES).optional(),
    AI_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(AI_LIMITS.minimumTimeoutMs)
      .max(AI_LIMITS.maximumTimeoutMs)
      .optional(),
    AI_DEBUG_LOGS: z.enum(["true", "false"]).optional(),
    OLLAMA_BASE_URL: z.string().url().optional(),
    OLLAMA_MODEL: OptionalNonemptyStringSchema,
    CLOUDFLARE_AI_MODEL: OptionalNonemptyStringSchema,
    CLOUDFLARE_AI_FALLBACK_MODEL: OptionalNonemptyStringSchema,
    CLOUDFLARE_AI_STRUCTURED_MODE: z
      .enum(CLOUDFLARE_STRUCTURED_MODES)
      .optional(),
  })
  .passthrough()
  .transform((environment) => ({
    provider:
      environment.AI_PROVIDER ?? defaultProvider(environment.NODE_ENV),
    timeoutMs: environment.AI_TIMEOUT_MS ?? AI_LIMITS.defaultTimeoutMs,
    debugLogs: environment.AI_DEBUG_LOGS === "true",
    ollamaBaseUrl:
      environment.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    ollamaModel: environment.OLLAMA_MODEL ?? "qwen3:1.7b",
    cloudflareModel:
      environment.CLOUDFLARE_AI_MODEL ??
      "@cf/ibm-granite/granite-4.0-h-micro",
    cloudflareFallbackModel: environment.CLOUDFLARE_AI_FALLBACK_MODEL,
    cloudflareStructuredMode:
      environment.CLOUDFLARE_AI_STRUCTURED_MODE ?? "function_calling",
  }));

export type AiEnvironment = z.output<typeof AiEnvironmentSchema>;

export function parseAiEnvironment(
  environment: Record<string, string | undefined>,
): AiEnvironment {
  const result = AiEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    throw new AiProviderError("misconfigured", {
      provider: "disabled",
      cause: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      message: "AI environment configuration is invalid",
    });
  }
  return result.data;
}
