import "server-only";

import type { AiProvider } from "../ai-provider";
import { AiProviderError } from "../errors";
import type {
  AssistantResponse,
  ComposeAssistantResponseInput,
  ExplainPlanInput,
  ParsedRoutineTurn,
  ParseRoutineTurnInput,
  ParseRoutineModificationInput,
  RoutineModificationResult,
  SafetyClassification,
  SafetyClassificationInput,
} from "../schemas";

export class DisabledAiProvider implements AiProvider {
  readonly id = "disabled" as const;
  readonly model = null;

  private unavailable(operation: string): never {
    throw new AiProviderError("disabled", {
      provider: this.id,
      operation,
    });
  }

  async parseRoutineTurn(
    input: ParseRoutineTurnInput,
  ): Promise<ParsedRoutineTurn> {
    void input;
    return this.unavailable("parse_routine_turn");
  }

  async composeAssistantResponse(
    input: ComposeAssistantResponseInput,
  ): Promise<AssistantResponse> {
    void input;
    return this.unavailable("compose_assistant_response");
  }

  async parseRoutineModification(
    input: ParseRoutineModificationInput,
  ): Promise<RoutineModificationResult> {
    void input;
    return this.unavailable("parse_routine_modification");
  }

  async classifySafety(
    input: SafetyClassificationInput,
  ): Promise<SafetyClassification> {
    void input;
    return this.unavailable("classify_safety");
  }

  async explainPlan(input: ExplainPlanInput): Promise<string> {
    void input;
    return this.unavailable("explain_plan");
  }
}
