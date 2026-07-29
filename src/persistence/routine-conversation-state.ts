import { z } from "zod";

import { AI_ERROR_CODES } from "@/ai/errors";
import { AI_PROVIDER_NAMES } from "@/ai/ai-provider";
import { SafetySignalsListSchema } from "@/ai/schemas/safety";
import {
  deriveMissingFields,
  deriveProfileCompletion,
} from "@/application/conversation/routine-turn-state";
import {
  LimitationsConfirmationSchema,
  RoutineRequestDraftSchema,
  createEmptyRoutineRequestDraft,
  type LimitationsConfirmation,
  type RequiredRoutineField,
  type RoutineRequestDraft,
} from "@/domain/profile/routine-draft";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "@/domain/profile/routine-request";
import {
  RoutinePlanSchema,
  type RoutinePlan,
} from "@/domain/routine/schemas";
import {
  SafetyClassificationSchema as DomainSafetyClassificationSchema,
  SafetyReasonCodeSchema,
  SafetyScreeningSchema,
  type SafetyAssessment,
  type SafetyScreening,
} from "@/domain/safety/schemas";
import {
  ConversationalSafetyScreeningDraftSchema,
  createEmptyConversationalSafetyScreeningDraft,
  deriveConversationalSafetyStatus,
  safetyScreeningToConversationalDraft,
  type ConversationalSafetyScreeningDraft,
} from "@/domain/safety/conversational-screening";

export const CONVERSATION_MESSAGE_ROLES = ["user", "assistant"] as const;

export const ConversationMessageSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    role: z.enum(CONVERSATION_MESSAGE_ROLES),
    content: z.string().trim().min(1).max(4_000),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ConversationMessage = z.output<typeof ConversationMessageSchema>;

/**
 * A generated plan remains paired with the exact validated inputs that produced
 * it. Those values are a generation snapshot, not a second editable profile.
 */
export const CurrentRoutineSchema = z
  .object({
    request: RoutineRequestSchema,
    plan: RoutinePlanSchema,
    safetyScreening: SafetyScreeningSchema,
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type CurrentRoutine = z.output<typeof CurrentRoutineSchema>;

export const SafetyAssessmentSnapshotSchema = z
  .object({
    allowed: z.boolean(),
    classification: DomainSafetyClassificationSchema,
    reasonCodes: z.array(SafetyReasonCodeSchema).max(32),
    message: z.string().trim().min(1).max(1_500),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.allowed !== (value.classification === "eligible") ||
      (value.allowed && value.reasonCodes.length > 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "El resultado de seguridad es internamente inconsistente.",
      });
    }
  });

export const ConversationSafetyStateSchema = z
  .object({
    signals: SafetySignalsListSchema,
    screeningDraft: ConversationalSafetyScreeningDraftSchema
      .optional()
      .default(createEmptyConversationalSafetyScreeningDraft()),
    screening: SafetyScreeningSchema.nullable(),
    result: SafetyAssessmentSnapshotSchema.nullable(),
  })
  .strict();

export type ConversationSafetyState = {
  signals: z.output<typeof SafetySignalsListSchema>;
  screeningDraft: ConversationalSafetyScreeningDraft;
  screening: SafetyScreening | null;
  result: SafetyAssessment | null;
};

export function createEmptyConversationSafetyState(): ConversationSafetyState {
  return {
    signals: [],
    screeningDraft: createEmptyConversationalSafetyScreeningDraft(),
    screening: null,
    result: null,
  };
}

const AiProviderErrorSnapshotSchema = z
  .object({
    code: z.enum(AI_ERROR_CODES),
    title: z.string().trim().min(1).max(240),
    message: z.string().trim().min(1).max(1_000),
    canRetry: z.boolean(),
    retryAfterSeconds: z.number().int().positive().max(86_400).optional(),
  })
  .strict();

const ProviderIdentitySchema = z.object({
  providerId: z.enum(AI_PROVIDER_NAMES).nullable(),
  model: z.string().trim().min(1).max(240).nullable(),
});

export const AiProviderStateSchema = z.discriminatedUnion("status", [
  ProviderIdentitySchema.extend({
    status: z.literal("idle"),
    error: z.null(),
  }).strict(),
  ProviderIdentitySchema.extend({
    status: z.literal("ready"),
    error: z.null(),
  }).strict(),
  ProviderIdentitySchema.extend({
    status: z.literal("error"),
    error: AiProviderErrorSnapshotSchema,
  }).strict(),
  ProviderIdentitySchema.extend({
    status: z.literal("disabled"),
    error: z.null(),
  }).strict(),
]);

export type AiProviderState = z.output<typeof AiProviderStateSchema>;

export function createIdleAiProviderState(): AiProviderState {
  return {
    status: "idle",
    providerId: null,
    model: null,
    error: null,
  };
}

/** A loading state is accepted only while decoding storage and becomes idle. */
const StoredAiProviderStateSchema = z.union([
  AiProviderStateSchema,
  ProviderIdentitySchema.extend({
    status: z.literal("loading"),
    error: z.null().optional().default(null),
  }).strict(),
]);

export const ConversationRetryMetadataSchema = z
  .object({
    lastUserMessageId: z.string().trim().min(1).max(160),
    failedAt: z.string().datetime({ offset: true }),
    attemptCount: z.number().int().min(1).max(20),
  })
  .strict();

export type ConversationRetryMetadata = z.output<
  typeof ConversationRetryMetadataSchema
>;

const RoutineConversationStateInputSchema = z
  .object({
    messages: z.array(ConversationMessageSchema).max(100),
    requestDraft: RoutineRequestDraftSchema,
    limitationsConfirmation: LimitationsConfirmationSchema,
    // Kept in the serialized envelope for easy inspection, then always replaced
    // by deterministic derivation when reading or writing.
    missingFields: z.array(z.string()).max(32).optional().default([]),
    completionPercentage: z.number().min(0).max(100).optional().default(0),
    safety: ConversationSafetyStateSchema,
    currentRoutine: CurrentRoutineSchema.nullable(),
    providerState: StoredAiProviderStateSchema,
    retryMetadata: ConversationRetryMetadataSchema.nullable(),
    lastUpdatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type RoutineConversationState = {
  messages: ConversationMessage[];
  requestDraft: RoutineRequestDraft;
  limitationsConfirmation: LimitationsConfirmation;
  missingFields: RequiredRoutineField[];
  completionPercentage: number;
  safety: ConversationSafetyState;
  currentRoutine: CurrentRoutine | null;
  providerState: AiProviderState;
  retryMetadata: ConversationRetryMetadata | null;
  lastUpdatedAt: string;
};

function normalizeProviderState(
  state: z.output<typeof StoredAiProviderStateSchema>,
): AiProviderState {
  if (state.status !== "loading") return AiProviderStateSchema.parse(state);
  return {
    status: "idle",
    providerId: state.providerId,
    model: state.model,
    error: null,
  };
}

function normalizeSafetyState(
  state: z.output<typeof ConversationSafetyStateSchema>,
): ConversationSafetyState {
  const parsed = ConversationSafetyStateSchema.parse(state);
  const screeningDraft = parsed.screening
    ? safetyScreeningToConversationalDraft(parsed.screening)
    : parsed.screeningDraft;
  if (parsed.signals.length === 0) return { ...parsed, screeningDraft };

  // A screening/result can become stale after a later conversational safety
  // signal. Persist the plan snapshot, but never persist an eligible current
  // safety result beside blocking evidence.
  return {
    signals: parsed.signals,
    screeningDraft,
    screening: null,
    result: null,
  };
}

/**
 * This parser is the canonical boundary for both persisted and caller-supplied
 * conversation state. Derived fields and dangling retry references are never
 * trusted from storage.
 */
export const RoutineConversationStateSchema =
  RoutineConversationStateInputSchema.transform(
    (value): RoutineConversationState => {
      const requestDraft = RoutineRequestDraftSchema.parse(value.requestDraft);
      const safetyDraft = value.safety.screening
        ? safetyScreeningToConversationalDraft(value.safety.screening)
        : value.safety.screeningDraft;
      const safetyStatus = deriveConversationalSafetyStatus(
        safetyDraft,
        value.safety.signals,
      );
      const effectiveSafetyStatus =
        value.safety.screening === null && safetyStatus === "eligible"
          ? "pending"
          : safetyStatus;
      const limitationsConfirmation: LimitationsConfirmation =
        effectiveSafetyStatus === "eligible"
          ? "confirmed_none"
          : effectiveSafetyStatus === "blocked"
            ? "confirmed_with_limitations"
            : "not_confirmed";
      const messages = value.messages.map((message) => ({ ...message }));
      const providerState = normalizeProviderState(value.providerState);
      const retryMetadata =
        providerState.status === "error" &&
        value.retryMetadata &&
        messages.some(
          (message) =>
            message.role === "user" &&
            message.id === value.retryMetadata?.lastUserMessageId,
        )
          ? value.retryMetadata
          : null;

      return {
        messages,
        requestDraft,
        limitationsConfirmation,
        missingFields: deriveMissingFields(
          requestDraft,
          limitationsConfirmation,
        ),
        completionPercentage: deriveProfileCompletion(
          requestDraft,
          limitationsConfirmation,
        ),
        safety: normalizeSafetyState(value.safety),
        currentRoutine: value.currentRoutine,
        providerState,
        retryMetadata,
        lastUpdatedAt: value.lastUpdatedAt,
      };
    },
  );

export const EMPTY_CONVERSATION_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function createEmptyRoutineConversationState(
  lastUpdatedAt = EMPTY_CONVERSATION_TIMESTAMP,
): RoutineConversationState {
  return RoutineConversationStateSchema.parse({
    messages: [],
    requestDraft: createEmptyRoutineRequestDraft(),
    limitationsConfirmation: "not_confirmed",
    missingFields: [],
    completionPercentage: 0,
    safety: createEmptyConversationSafetyState(),
    currentRoutine: null,
    providerState: createIdleAiProviderState(),
    retryMetadata: null,
    lastUpdatedAt,
  });
}

export type RoutineConversationStatePatch = Partial<
  Pick<
    RoutineConversationState,
    | "messages"
    | "requestDraft"
    | "limitationsConfirmation"
    | "safety"
    | "currentRoutine"
    | "providerState"
    | "retryMetadata"
  >
>;

export type RoutineConversationStateUpdate =
  | RoutineConversationStatePatch
  | ((
      current: Readonly<RoutineConversationState>,
    ) => RoutineConversationStatePatch);

export type { RoutinePlan, RoutineRequest };
