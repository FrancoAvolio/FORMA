import type {
  ExplainPlanInput,
  ParseRoutineInput,
  ParseRoutineModificationInput,
  ParseRoutineResult,
  RoutineModificationResult,
  SafetyClassification,
  SafetyClassificationInput,
} from "./schemas";

export const AI_PROVIDER_NAMES = [
  "ollama",
  "cloudflare",
  "mock",
  "disabled",
] as const;

export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export interface AiProvider {
  readonly id: AiProviderName;
  readonly model: string | null;

  parseRoutineRequest(input: ParseRoutineInput): Promise<ParseRoutineResult>;

  parseRoutineModification(
    input: ParseRoutineModificationInput,
  ): Promise<RoutineModificationResult>;

  classifySafety(
    input: SafetyClassificationInput,
  ): Promise<SafetyClassification>;

  explainPlan(input: ExplainPlanInput): Promise<string>;
}

