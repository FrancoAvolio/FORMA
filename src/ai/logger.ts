export type AiLogLevel = "debug" | "info" | "warn" | "error";

export type AiLogMetadata = Readonly<{
  provider: string;
  operation: string;
  model?: string;
  attempt?: number;
  durationMs?: number;
  code?: string;
}>;

export interface AiLogger {
  log(level: AiLogLevel, event: string, metadata: AiLogMetadata): void;
}

export const silentAiLogger: AiLogger = {
  log: () => undefined,
};

/**
 * Logs only allow-listed operational metadata. Prompts, user text and model
 * responses are deliberately absent from AiLogMetadata.
 */
export const consoleAiLogger: AiLogger = {
  log(level, event, metadata) {
    const method = level === "debug" ? "debug" : level;
    console[method](`[forma:ai] ${event}`, metadata);
  },
};

