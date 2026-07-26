import "server-only";

import { AiProviderError, isAiProviderError } from "../errors";
import { AI_LIMITS } from "../limits";
import type { AiLogger } from "../logger";
import { assertMaximumBytes, withAiDeadline } from "../runtime";
import type { StructuredModelInvocation } from "../structured-output";
import {
  BaseStructuredAiProvider,
  type StructuredProviderConfig,
} from "./base-structured-provider";

export const CLOUDFLARE_STRUCTURED_MODES = [
  "function_calling",
  "json_schema",
  "json_object",
] as const;

export type CloudflareStructuredMode =
  (typeof CLOUDFLARE_STRUCTURED_MODES)[number];

export interface CloudflareAiBinding {
  run(
    model: string,
    request: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
}

export type CloudflareAiProviderConfig = StructuredProviderConfig & {
  binding?: CloudflareAiBinding | null;
  model?: string;
  fallbackModel?: string | null;
  structuredMode?: CloudflareStructuredMode;
  timeoutMs?: number;
  logger?: AiLogger;
};

type ErrorLike = {
  status?: unknown;
  code?: unknown;
  message?: unknown;
  retryAfter?: unknown;
};

function errorDetails(error: unknown): ErrorLike {
  return typeof error === "object" && error !== null ? (error as ErrorLike) : {};
}

function mapCloudflareError(error: unknown, operation: string): AiProviderError {
  if (isAiProviderError(error)) {
    return error;
  }

  const details = errorDetails(error);
  const status = typeof details.status === "number" ? details.status : undefined;
  const code = typeof details.code === "string" ? details.code : "";
  const message =
    typeof details.message === "string"
      ? details.message.toLocaleLowerCase("en")
      : "";
  const retryAfterSeconds =
    typeof details.retryAfter === "number" ? details.retryAfter : undefined;

  if (
    message.includes("quota") ||
    message.includes("daily limit") ||
    message.includes("neurons exceeded") ||
    code === "quota_exceeded"
  ) {
    return new AiProviderError("quota_exhausted", {
      provider: "cloudflare",
      operation,
      cause: error,
    });
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return new AiProviderError("rate_limited", {
      provider: "cloudflare",
      operation,
      cause: error,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    });
  }
  if (
    message.includes("unsupported model") ||
    message.includes("model not found") ||
    code === "model_not_found"
  ) {
    return new AiProviderError("unsupported_model", {
      provider: "cloudflare",
      operation,
      cause: error,
    });
  }
  if (status === 408 || status === 504 || code === "timeout") {
    return new AiProviderError("timeout", {
      provider: "cloudflare",
      operation,
      cause: error,
    });
  }
  if (status !== undefined && status >= 500) {
    return new AiProviderError("unavailable", {
      provider: "cloudflare",
      operation,
      cause: error,
    });
  }

  return new AiProviderError("provider_error", {
    provider: "cloudflare",
    operation,
    cause: error,
  });
}

function findToolArguments(value: unknown): unknown | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const toolCalls = Array.isArray(record.tool_calls)
    ? record.tool_calls
    : Array.isArray(record.toolCalls)
      ? record.toolCalls
      : null;

  if (!toolCalls || toolCalls.length === 0) {
    return undefined;
  }

  const first = toolCalls[0];
  if (typeof first !== "object" || first === null) {
    return undefined;
  }
  const firstRecord = first as Record<string, unknown>;
  const fn = firstRecord.function;
  if (typeof fn === "object" && fn !== null && "arguments" in fn) {
    return (fn as Record<string, unknown>).arguments;
  }
  return firstRecord.arguments;
}

function extractCloudflarePayload(response: unknown): unknown {
  const directToolArguments = findToolArguments(response);
  if (directToolArguments !== undefined) {
    return directToolArguments;
  }

  if (typeof response !== "object" || response === null) {
    return response;
  }

  const record = response as Record<string, unknown>;
  if ("result" in record) {
    const nested = extractCloudflarePayload(record.result);
    if (nested !== undefined) {
      return nested;
    }
  }
  if ("response" in record) {
    return record.response;
  }

  return response;
}

export class CloudflareAiProvider extends BaseStructuredAiProvider {
  readonly id = "cloudflare" as const;
  readonly model: string;

  private readonly binding?: CloudflareAiBinding | null;
  private readonly fallbackModel?: string;
  private readonly structuredMode: CloudflareStructuredMode;
  private readonly timeoutMs: number;

  constructor(config: CloudflareAiProviderConfig = {}) {
    super(config);
    this.binding = config.binding;
    this.model =
      config.model?.trim() || "@cf/ibm-granite/granite-4.0-h-micro";
    this.fallbackModel = config.fallbackModel?.trim() || undefined;
    this.structuredMode = config.structuredMode ?? "function_calling";
    this.timeoutMs = config.timeoutMs ?? AI_LIMITS.defaultTimeoutMs;

    if (
      this.timeoutMs < AI_LIMITS.minimumTimeoutMs ||
      this.timeoutMs > AI_LIMITS.maximumTimeoutMs
    ) {
      throw new AiProviderError("misconfigured", {
        provider: this.id,
        message: "Cloudflare timeout is outside the supported range",
      });
    }
  }

  private buildRequest(invocation: StructuredModelInvocation) {
    const messages = [
      { role: "system", content: invocation.systemPrompt },
      { role: "user", content: invocation.userPrompt },
    ];

    if (this.structuredMode === "function_calling") {
      const functionName = `forma_${invocation.operation}`;
      return {
        messages,
        temperature: 0,
        max_tokens: AI_LIMITS.cloudflareMaxTokens,
        tools: [
          {
            type: "function",
            function: {
              name: functionName,
              description: "Devuelve el contrato estructurado solicitado por FORMA.",
              parameters: invocation.jsonSchema,
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: functionName },
        },
      };
    }

    if (this.structuredMode === "json_schema") {
      return {
        messages,
        temperature: 0,
        max_tokens: AI_LIMITS.cloudflareMaxTokens,
        response_format: {
          type: "json_schema",
          json_schema: invocation.jsonSchema,
        },
      };
    }

    return {
      messages,
      temperature: 0,
      max_tokens: AI_LIMITS.cloudflareMaxTokens,
      response_format: { type: "json_object" },
    };
  }

  private async runModel(
    model: string,
    request: Record<string, unknown>,
    invocation: StructuredModelInvocation,
  ): Promise<unknown> {
    if (!this.binding) {
      throw new AiProviderError("binding_missing", {
        provider: this.id,
        operation: invocation.operation,
      });
    }

    return withAiDeadline({
      provider: this.id,
      operation: invocation.operation,
      timeoutMs: this.timeoutMs,
      ...(invocation.signal ? { signal: invocation.signal } : {}),
      run: (signal) => this.binding!.run(model, request, { signal }),
    });
  }

  protected async invokeStructured(
    invocation: StructuredModelInvocation,
  ): Promise<unknown> {
    const request = this.buildRequest(invocation);
    assertMaximumBytes({
      value: JSON.stringify(request),
      maximum: AI_LIMITS.providerRequestBytes,
      kind: "input",
      provider: this.id,
      operation: invocation.operation,
    });

    let response: unknown;
    try {
      response = await this.runModel(this.model, request, invocation);
    } catch (error) {
      const mapped = mapCloudflareError(error, invocation.operation);
      if (
        mapped.code !== "unsupported_model" ||
        !this.fallbackModel ||
        this.fallbackModel === this.model
      ) {
        throw mapped;
      }

      this.logger.log("warn", "model_fallback", {
        provider: this.id,
        operation: invocation.operation,
        model: this.model,
        attempt: invocation.attempt,
        code: mapped.code,
      });
      try {
        response = await this.runModel(this.fallbackModel, request, invocation);
      } catch (fallbackError) {
        throw mapCloudflareError(fallbackError, invocation.operation);
      }
    }

    const payload = extractCloudflarePayload(response);
    let serialized: string;
    try {
      serialized =
        typeof payload === "string" ? payload : JSON.stringify(payload);
    } catch (error) {
      throw new AiProviderError("invalid_output", {
        provider: this.id,
        operation: invocation.operation,
        cause: error,
      });
    }
    assertMaximumBytes({
      value: serialized,
      maximum: AI_LIMITS.outputBytes,
      kind: "output",
      provider: this.id,
      operation: invocation.operation,
    });
    return payload;
  }
}

