import { z } from "zod";

import { AiProviderError } from "./errors";
import { AI_LIMITS } from "./limits";
import type { AiLogger } from "./logger";
import {
  buildRepairUserPrompt,
  REPAIR_STRUCTURED_OUTPUT_PROMPT,
} from "./prompts/repair-structured-output";
import { assertMaximumBytes } from "./runtime";

export type JsonSchema = Record<string, unknown>;

export type AiOperation =
  | "parse_routine_turn"
  | "compose_assistant_response"
  | "parse_routine_modification"
  | "classify_safety"
  | "explain_plan";

export type StructuredModelInvocation = {
  operation: AiOperation;
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: JsonSchema;
  attempt: 1 | 2;
  signal?: AbortSignal;
};

export type StructuredModelInvoker = (
  invocation: StructuredModelInvocation,
) => Promise<unknown>;

function schemaAsRecord(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, {
    target: "draft-7",
    unrepresentable: "any",
  }) as JsonSchema;
}

function serializeInvalidOutput(raw: unknown): string {
  let serialized: string;
  if (typeof raw === "string") {
    serialized = raw;
  } else {
    try {
      serialized = JSON.stringify(raw);
    } catch {
      serialized = "[unserializable output]";
    }
  }

  return serialized.slice(0, AI_LIMITS.repairPayloadCharacters);
}

function parseWholeJson(raw: unknown, options: {
  provider: string;
  operation: AiOperation;
}): unknown {
  if (typeof raw === "string") {
    assertMaximumBytes({
      value: raw,
      maximum: AI_LIMITS.outputBytes,
      kind: "output",
      provider: options.provider,
      operation: options.operation,
    });
    return JSON.parse(raw);
  }

  if (raw !== null && typeof raw === "object") {
    const serialized = JSON.stringify(raw);
    assertMaximumBytes({
      value: serialized,
      maximum: AI_LIMITS.outputBytes,
      kind: "output",
      provider: options.provider,
      operation: options.operation,
    });
    return raw;
  }

  throw new TypeError("Structured model output must be an object or complete JSON string");
}

function validationIssues(error: unknown): string[] {
  if (error instanceof z.ZodError) {
    return error.issues.slice(0, 16).map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    });
  }
  if (error instanceof Error) {
    return [error.message.slice(0, 300)];
  }
  return ["La salida no es JSON válido."];
}

function validateRaw<TSchema extends z.ZodType>(
  raw: unknown,
  schema: TSchema,
  provider: string,
  operation: AiOperation,
): { success: true; data: z.output<TSchema> } | { success: false; error: unknown } {
  try {
    const parsedJson = parseWholeJson(raw, { provider, operation });
    const result = schema.safeParse(parsedJson);
    return result.success
      ? { success: true, data: result.data }
      : { success: false, error: result.error };
  } catch (error) {
    if (
      error instanceof AiProviderError &&
      error.code === "response_too_large"
    ) {
      throw error;
    }
    return { success: false, error };
  }
}

export async function executeStructuredWithRepair<
  TSchema extends z.ZodType,
>(options: {
  provider: string;
  model: string | null;
  operation: AiOperation;
  prompt: { system: string; user: string; version: string };
  schema: TSchema;
  signal?: AbortSignal;
  invoke: StructuredModelInvoker;
  logger: AiLogger;
}): Promise<z.output<TSchema>> {
  const jsonSchema = schemaAsRecord(options.schema);
  const schemaText = JSON.stringify(jsonSchema);
  const systemWithContract = `${options.prompt.system}\n\nJSON SCHEMA COMPLETO (${options.prompt.version})\n${schemaText}`;

  const firstRaw = await options.invoke({
    operation: options.operation,
    systemPrompt: systemWithContract,
    userPrompt: options.prompt.user,
    jsonSchema,
    attempt: 1,
    signal: options.signal,
  });
  const first = validateRaw(
    firstRaw,
    options.schema,
    options.provider,
    options.operation,
  );

  if (first.success) {
    return first.data;
  }

  options.logger.log("warn", "structured_output_repair", {
    provider: options.provider,
    operation: options.operation,
    ...(options.model ? { model: options.model } : {}),
    attempt: 2,
    code: "invalid_output",
  });

  const repairedRaw = await options.invoke({
    operation: options.operation,
    systemPrompt: `${REPAIR_STRUCTURED_OUTPUT_PROMPT.system}\n\nJSON SCHEMA COMPLETO (${options.prompt.version})\n${schemaText}`,
    userPrompt: buildRepairUserPrompt({
      operation: options.operation,
      issues: validationIssues(first.error),
      invalidOutput: serializeInvalidOutput(firstRaw),
    }),
    jsonSchema,
    attempt: 2,
    signal: options.signal,
  });
  const repaired = validateRaw(
    repairedRaw,
    options.schema,
    options.provider,
    options.operation,
  );

  if (repaired.success) {
    return repaired.data;
  }

  throw new AiProviderError("invalid_output", {
    provider: options.provider,
    operation: options.operation,
    cause: validationIssues(repaired.error),
    message: "Model output remained invalid after one repair attempt",
  });
}
