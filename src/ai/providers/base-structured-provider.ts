import "server-only";

import type { z } from "zod";

import type { AiProvider, AiProviderName } from "../ai-provider";
import { AiProviderError } from "../errors";
import { AI_LIMITS } from "../limits";
import type { AiLogger } from "../logger";
import { silentAiLogger } from "../logger";
import {
  buildComposeAssistantResponseUserPrompt,
  COMPOSE_ASSISTANT_RESPONSE_PROMPT,
} from "../prompts/compose-assistant-response";
import {
  buildClassifySafetyUserPrompt,
  CLASSIFY_SAFETY_PROMPT,
} from "../prompts/classify-safety";
import {
  buildExplainRoutineUserPrompt,
  EXPLAIN_ROUTINE_PROMPT,
} from "../prompts/explain-routine";
import {
  buildParseRoutineModificationUserPrompt,
  PARSE_ROUTINE_MODIFICATION_PROMPT,
} from "../prompts/parse-routine-modification";
import {
  buildParseRoutineTurnUserPrompt,
  PARSE_ROUTINE_TURN_PROMPT,
} from "../prompts/parse-routine-request";
import { assertMaximumBytes } from "../runtime";
import {
  AssistantResponseSchema,
  ComposeAssistantResponseInputDataSchema,
  createRoutineModificationResultSchema,
  createSafetyClassificationSchema,
  ExplainPlanInputDataSchema,
  ExplainPlanResultSchema,
  ParsedRoutineTurnSchema,
  ParseRoutineTurnInputDataSchema,
  ParseRoutineModificationInputDataSchema,
  SafetyClassificationInputDataSchema,
  type AssistantResponse,
  type ComposeAssistantResponseInput,
  type ExplainPlanInput,
  type ParsedRoutineTurn,
  type ParseRoutineTurnInput,
  type ParseRoutineModificationInput,
  type RoutineModificationResult,
  type SafetyClassification,
  type SafetyClassificationInput,
} from "../schemas";
import {
  executeStructuredWithRepair,
  type AiOperation,
  type StructuredModelInvocation,
} from "../structured-output";

type InputWithSignal = { signal?: AbortSignal };

export type StructuredProviderConfig = {
  logger?: AiLogger;
};

export abstract class BaseStructuredAiProvider implements AiProvider {
  abstract readonly id: AiProviderName;
  abstract readonly model: string;

  protected readonly logger: AiLogger;

  protected constructor(config: StructuredProviderConfig = {}) {
    this.logger = config.logger ?? silentAiLogger;
  }

  protected abstract invokeStructured(
    invocation: StructuredModelInvocation,
  ): Promise<unknown>;

  private parseInput<TSchema extends z.ZodType>(
    input: z.input<TSchema> & InputWithSignal,
    schema: TSchema,
    operation: AiOperation,
  ): { data: z.output<TSchema>; signal?: AbortSignal } {
    const { signal, ...untrusted } = input;
    const result = schema.safeParse(untrusted);
    if (!result.success) {
      throw new AiProviderError("invalid_input", {
        provider: this.id,
        operation,
        cause: result.error.issues,
        message: "AI input did not pass its schema",
      });
    }

    assertMaximumBytes({
      value: JSON.stringify(result.data),
      maximum: AI_LIMITS.inputBytes,
      kind: "input",
      provider: this.id,
      operation,
    });

    return { data: result.data, ...(signal ? { signal } : {}) };
  }

  private async execute<TSchema extends z.ZodType>(options: {
    operation: AiOperation;
    prompt: { system: string; user: string; version: string };
    schema: TSchema;
    signal?: AbortSignal;
  }): Promise<z.output<TSchema>> {
    const startedAt = Date.now();
    try {
      const output = await executeStructuredWithRepair({
        provider: this.id,
        model: this.model,
        operation: options.operation,
        prompt: options.prompt,
        schema: options.schema,
        ...(options.signal ? { signal: options.signal } : {}),
        invoke: (invocation) => this.invokeStructured(invocation),
        logger: this.logger,
      });
      this.logger.log("info", "request_complete", {
        provider: this.id,
        operation: options.operation,
        model: this.model,
        durationMs: Date.now() - startedAt,
      });
      return output;
    } catch (error) {
      this.logger.log("warn", "request_failed", {
        provider: this.id,
        operation: options.operation,
        model: this.model,
        durationMs: Date.now() - startedAt,
        code: error instanceof AiProviderError ? error.code : "provider_error",
      });
      throw error;
    }
  }

  async parseRoutineTurn(
    input: ParseRoutineTurnInput,
  ): Promise<ParsedRoutineTurn> {
    const parsed = this.parseInput(
      input,
      ParseRoutineTurnInputDataSchema,
      "parse_routine_turn",
    );
    return this.execute({
      operation: "parse_routine_turn",
      prompt: {
        system: PARSE_ROUTINE_TURN_PROMPT.system,
        user: buildParseRoutineTurnUserPrompt(parsed.data),
        version: PARSE_ROUTINE_TURN_PROMPT.version,
      },
      schema: ParsedRoutineTurnSchema,
      ...(parsed.signal ? { signal: parsed.signal } : {}),
    });
  }

  async composeAssistantResponse(
    input: ComposeAssistantResponseInput,
  ): Promise<AssistantResponse> {
    const parsed = this.parseInput(
      input,
      ComposeAssistantResponseInputDataSchema,
      "compose_assistant_response",
    );
    return this.execute({
      operation: "compose_assistant_response",
      prompt: {
        system: COMPOSE_ASSISTANT_RESPONSE_PROMPT.system,
        user: buildComposeAssistantResponseUserPrompt(parsed.data),
        version: COMPOSE_ASSISTANT_RESPONSE_PROMPT.version,
      },
      schema: AssistantResponseSchema,
      ...(parsed.signal ? { signal: parsed.signal } : {}),
    });
  }

  async parseRoutineModification(
    input: ParseRoutineModificationInput,
  ): Promise<RoutineModificationResult> {
    const parsed = this.parseInput(
      input,
      ParseRoutineModificationInputDataSchema,
      "parse_routine_modification",
    );
    return this.execute({
      operation: "parse_routine_modification",
      prompt: {
        system: PARSE_ROUTINE_MODIFICATION_PROMPT.system,
        user: buildParseRoutineModificationUserPrompt(parsed.data),
        version: PARSE_ROUTINE_MODIFICATION_PROMPT.version,
      },
      schema: createRoutineModificationResultSchema(parsed.data),
      ...(parsed.signal ? { signal: parsed.signal } : {}),
    });
  }

  async classifySafety(
    input: SafetyClassificationInput,
  ): Promise<SafetyClassification> {
    const parsed = this.parseInput(
      input,
      SafetyClassificationInputDataSchema,
      "classify_safety",
    );
    return this.execute({
      operation: "classify_safety",
      prompt: {
        system: CLASSIFY_SAFETY_PROMPT.system,
        user: buildClassifySafetyUserPrompt(parsed.data),
        version: CLASSIFY_SAFETY_PROMPT.version,
      },
      schema: createSafetyClassificationSchema(parsed.data.deterministicSignals),
      ...(parsed.signal ? { signal: parsed.signal } : {}),
    });
  }

  async explainPlan(input: ExplainPlanInput): Promise<string> {
    const parsed = this.parseInput(
      input,
      ExplainPlanInputDataSchema,
      "explain_plan",
    );
    const result = await this.execute({
      operation: "explain_plan",
      prompt: {
        system: EXPLAIN_ROUTINE_PROMPT.system,
        user: buildExplainRoutineUserPrompt(parsed.data),
        version: EXPLAIN_ROUTINE_PROMPT.version,
      },
      schema: ExplainPlanResultSchema,
      ...(parsed.signal ? { signal: parsed.signal } : {}),
    });
    return result.explanation;
  }
}
