import "server-only";

import type { AiProvider } from "../ai-provider";
import { consoleAiLogger, type AiLogger, silentAiLogger } from "../logger";
import { CloudflareAiProvider, type CloudflareAiBinding } from "./cloudflare-provider";
import { DisabledAiProvider } from "./disabled-provider";
import {
  parseAiEnvironment,
  type AiEnvironment,
} from "./ai-environment.server";
import { MockAiProvider, type MockAiProviderConfig } from "./mock-provider";
import { OllamaAiProvider } from "./ollama-provider";

export type CreateAiProviderOptions = {
  environment?: Record<string, string | undefined> | AiEnvironment;
  cloudflareBinding?: CloudflareAiBinding | null;
  fetchImplementation?: typeof fetch;
  mock?: MockAiProviderConfig;
  logger?: AiLogger;
};

function isParsedEnvironment(
  value: Record<string, string | undefined> | AiEnvironment,
): value is AiEnvironment {
  return "provider" in value && "timeoutMs" in value;
}

export function createAiProvider(
  options: CreateAiProviderOptions = {},
): AiProvider {
  const suppliedEnvironment = options.environment ?? process.env;
  const environment = isParsedEnvironment(suppliedEnvironment)
    ? suppliedEnvironment
    : parseAiEnvironment(suppliedEnvironment);
  const logger =
    options.logger ??
    (environment.debugLogs ? consoleAiLogger : silentAiLogger);

  switch (environment.provider) {
    case "ollama":
      return new OllamaAiProvider({
        baseUrl: environment.ollamaBaseUrl,
        model: environment.ollamaModel,
        timeoutMs: environment.timeoutMs,
        ...(options.fetchImplementation
          ? { fetchImplementation: options.fetchImplementation }
          : {}),
        logger,
      });
    case "cloudflare":
      return new CloudflareAiProvider({
        binding: options.cloudflareBinding,
        model: environment.cloudflareModel,
        fallbackModel: environment.cloudflareFallbackModel,
        structuredMode: environment.cloudflareStructuredMode,
        timeoutMs: environment.timeoutMs,
        logger,
      });
    case "mock":
      return new MockAiProvider(options.mock);
    case "disabled":
      return new DisabledAiProvider();
  }
}

