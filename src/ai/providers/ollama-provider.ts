import "server-only";

import { z } from "zod";

import { AiProviderError, isAiProviderError } from "../errors";
import { AI_LIMITS } from "../limits";
import type { AiLogger } from "../logger";
import {
  assertMaximumBytes,
  readResponseTextLimited,
  withAiDeadline,
} from "../runtime";
import type { StructuredModelInvocation } from "../structured-output";
import {
  BaseStructuredAiProvider,
  type StructuredProviderConfig,
} from "./base-structured-provider";

const OllamaEnvelopeSchema = z
  .object({
    message: z.object({ content: z.string() }).passthrough(),
  })
  .passthrough();

export type OllamaAiProviderConfig = StructuredProviderConfig & {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  fetchImplementation?: typeof fetch;
  logger?: AiLogger;
};

function normalizeBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Ollama URL must use HTTP or HTTPS");
    }
    return url.href.endsWith("/") ? url.href : `${url.href}/`;
  } catch (error) {
    throw new AiProviderError("misconfigured", {
      provider: "ollama",
      cause: error,
      message: "OLLAMA_BASE_URL is not a valid HTTP(S) URL",
    });
  }
}

function mapOllamaHttpError(status: number, body: string): AiProviderError {
  const normalized = body.toLocaleLowerCase("en");
  if (status === 404 && normalized.includes("model")) {
    return new AiProviderError("unsupported_model", {
      provider: "ollama",
      message: "The configured Ollama model is not installed",
    });
  }
  if (status === 429) {
    return new AiProviderError("rate_limited", { provider: "ollama" });
  }
  if (status === 408 || status === 504) {
    return new AiProviderError("timeout", { provider: "ollama" });
  }
  if (status >= 500) {
    return new AiProviderError("unavailable", { provider: "ollama" });
  }
  return new AiProviderError("provider_error", {
    provider: "ollama",
    message: `Ollama returned HTTP ${status}`,
  });
}

export class OllamaAiProvider extends BaseStructuredAiProvider {
  readonly id = "ollama" as const;
  readonly model: string;

  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(config: OllamaAiProviderConfig = {}) {
    super(config);
    this.baseUrl = normalizeBaseUrl(
      config.baseUrl ?? "http://127.0.0.1:11434",
    );
    this.model = config.model?.trim() || "qwen3:1.7b";
    this.timeoutMs = config.timeoutMs ?? AI_LIMITS.defaultTimeoutMs;
    this.fetchImplementation = config.fetchImplementation ?? fetch;

    if (
      this.timeoutMs < AI_LIMITS.minimumTimeoutMs ||
      this.timeoutMs > AI_LIMITS.maximumTimeoutMs
    ) {
      throw new AiProviderError("misconfigured", {
        provider: this.id,
        message: "Ollama timeout is outside the supported range",
      });
    }
  }

  protected async invokeStructured(
    invocation: StructuredModelInvocation,
  ): Promise<unknown> {
    const requestBody = JSON.stringify({
      model: this.model,
      stream: false,
      think: false,
      messages: [
        { role: "system", content: invocation.systemPrompt },
        { role: "user", content: invocation.userPrompt },
      ],
      format: invocation.jsonSchema,
      options: {
        temperature: 0,
        num_predict: AI_LIMITS.ollamaPredictTokens,
      },
    });

    assertMaximumBytes({
      value: requestBody,
      maximum: AI_LIMITS.providerRequestBytes,
      kind: "input",
      provider: this.id,
      operation: invocation.operation,
    });

    try {
      return await withAiDeadline({
        provider: this.id,
        operation: invocation.operation,
        timeoutMs: this.timeoutMs,
        ...(invocation.signal ? { signal: invocation.signal } : {}),
        run: async (signal) => {
          const response = await this.fetchImplementation(
            new URL("api/chat", this.baseUrl),
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: requestBody,
              signal,
              cache: "no-store",
            },
          );
          const text = await readResponseTextLimited(response, {
            maximumBytes: AI_LIMITS.outputBytes,
            provider: this.id,
            operation: invocation.operation,
          });

          if (!response.ok) {
            throw mapOllamaHttpError(response.status, text);
          }

          let envelope: unknown;
          try {
            envelope = JSON.parse(text);
          } catch (error) {
            throw new AiProviderError("provider_error", {
              provider: this.id,
              operation: invocation.operation,
              cause: error,
              message: "Ollama returned a malformed protocol envelope",
            });
          }

          const parsedEnvelope = OllamaEnvelopeSchema.safeParse(envelope);
          if (!parsedEnvelope.success) {
            throw new AiProviderError("provider_error", {
              provider: this.id,
              operation: invocation.operation,
              cause: parsedEnvelope.error.issues,
              message: "Ollama response did not contain message.content",
            });
          }

          return parsedEnvelope.data.message.content;
        },
      });
    } catch (error) {
      if (isAiProviderError(error)) {
        throw error;
      }
      if (error instanceof TypeError) {
        throw new AiProviderError("unavailable", {
          provider: this.id,
          operation: invocation.operation,
          cause: error,
          message: "Could not connect to Ollama",
        });
      }
      throw new AiProviderError("provider_error", {
        provider: this.id,
        operation: invocation.operation,
        cause: error,
      });
    }
  }
}

