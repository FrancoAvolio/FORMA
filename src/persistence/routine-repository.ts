import { z } from "zod";

import {
  RoutineRequestDraftSchema,
  createEmptyRoutineRequestDraft,
  type RoutineRequestDraft,
} from "@/domain/profile/routine-draft";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "@/domain/profile/routine-request";
import { RoutinePlanSchema, type RoutinePlan } from "@/domain/routine/schemas";
import { evaluateRoutineSafety } from "@/domain/safety/evaluate-safety";
import {
  SafetyScreeningSchema,
  type SafetyScreening,
} from "@/domain/safety/schemas";

import {
  ConversationMessageSchema,
  CurrentRoutineSchema,
  RoutineConversationStateSchema,
  createEmptyConversationSafetyState,
  createEmptyRoutineConversationState,
  createIdleAiProviderState,
  type ConversationMessage,
  type CurrentRoutine,
  type RoutineConversationState,
  type RoutineConversationStatePatch,
  type RoutineConversationStateUpdate,
} from "./routine-conversation-state";
import type { StorageDriver } from "./storage-driver";

const STORAGE_KEY = "forma:routines:v2";
const LEGACY_STORAGE_KEY = "forma:routines:v1";
const CURRENT_VERSION = 2 as const;

export const SavedRoutineSchema = z
  .object({
    id: z.string().trim().min(1),
    request: RoutineRequestSchema,
    plan: RoutinePlanSchema,
    safetyScreening: SafetyScreeningSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

/** Compatibility shape for callers moving from the v1 chat API. */
export const ConversationStateSchema = z
  .object({
    messages: z.array(ConversationMessageSchema).max(100),
    structuredProfile: RoutineRequestSchema.partial(),
    limitationsConfirmation: z.enum([
      "not_confirmed",
      "confirmed_none",
      "confirmed_with_limitations",
    ]),
  })
  .strict();

export const MediaPlaybackPreferenceSchema = z.enum([
  "system",
  "static",
  "animated",
  "reduced_motion",
]);

export type SavedRoutine = z.output<typeof SavedRoutineSchema>;
export type ConversationState = z.output<typeof ConversationStateSchema>;
export type MediaPlaybackPreference = z.output<
  typeof MediaPlaybackPreferenceSchema
>;
/** @deprecated Use RoutineRequestDraft through the canonical state API. */
export type RoutineDraft = Partial<RoutineRequest>;

const StorageEnvelopeSchema = z
  .object({
    version: z.literal(CURRENT_VERSION),
    routines: z.array(SavedRoutineSchema),
    conversationState: RoutineConversationStateSchema,
    mediaPlaybackPreference: MediaPlaybackPreferenceSchema,
  })
  .strict();

type StorageEnvelope = z.output<typeof StorageEnvelopeSchema>;

const LegacyConversationStateV1Schema = z
  .object({
    messages: z.array(ConversationMessageSchema).max(100),
    structuredProfile: RoutineRequestSchema.partial(),
    limitationsConfirmation: z
      .enum([
        "not_confirmed",
        "confirmed_none",
        "confirmed_with_limitations",
      ])
      .default("not_confirmed"),
  })
  .strict();

/** Exact pre-chat-first envelope shipped by the first implementation. */
const LegacyEnvelopeV1Schema = z
  .object({
    version: z.literal(1),
    routines: z.array(SavedRoutineSchema),
    setupDraft: RoutineRequestSchema.partial().nullable(),
    currentRoutine: CurrentRoutineSchema.nullable(),
    conversation: LegacyConversationStateV1Schema,
    mediaPlaybackPreference: MediaPlaybackPreferenceSchema,
  })
  .strict();

/** First internal prototype retained as an explicit migration boundary. */
const LegacyEnvelopeV0Schema = z
  .object({
    version: z.literal(0),
    routines: z.array(SavedRoutineSchema),
    draft: RoutineRequestSchema.partial().nullable(),
  })
  .strict();

function createEmptyEnvelope(): StorageEnvelope {
  return StorageEnvelopeSchema.parse({
    version: CURRENT_VERSION,
    routines: [],
    conversationState: createEmptyRoutineConversationState(),
    mediaPlaybackPreference: "system",
  });
}

function mergeLegacyProfile(
  base: RoutineRequestDraft,
  profile: Partial<RoutineRequest> | null,
): RoutineRequestDraft {
  if (profile === null) return RoutineRequestDraftSchema.parse(base);
  const parsed = RoutineRequestSchema.partial().parse(profile);
  const next: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(parsed)) {
    if (value === undefined) continue;
    next[key] = Array.isArray(value) ? [...value] : value;
  }

  return RoutineRequestDraftSchema.parse(next);
}

function draftToLegacyProfile(
  draft: RoutineRequestDraft,
): Partial<RoutineRequest> {
  const parsed = RoutineRequestDraftSchema.parse(draft);
  return RoutineRequestSchema.partial().parse({
    ...(parsed.goal === null ? {} : { goal: parsed.goal }),
    ...(parsed.experience === null ? {} : { experience: parsed.experience }),
    ...(parsed.daysPerWeek === null ? {} : { daysPerWeek: parsed.daysPerWeek }),
    ...(parsed.sessionMinutes === null
      ? {}
      : { sessionMinutes: parsed.sessionMinutes }),
    ...(parsed.trainingLocation === null
      ? {}
      : { trainingLocation: parsed.trainingLocation }),
    availableEquipment: parsed.availableEquipment,
    focusMuscles: parsed.focusMuscles,
    excludedExercises: parsed.excludedExercises,
    excludedMovementPatterns: parsed.excludedMovementPatterns,
    preferredExercises: parsed.preferredExercises,
    limitations: parsed.limitations,
    notes: parsed.notes,
  });
}

function isEmptyDraft(draft: RoutineRequestDraft): boolean {
  return (
    draft.goal === null &&
    draft.experience === null &&
    draft.daysPerWeek === null &&
    draft.sessionMinutes === null &&
    draft.trainingLocation === null &&
    draft.availableEquipment.length === 0 &&
    draft.focusMuscles.length === 0 &&
    draft.excludedExercises.length === 0 &&
    draft.excludedMovementPatterns.length === 0 &&
    draft.preferredExercises.length === 0 &&
    draft.limitations.length === 0 &&
    draft.notes === null
  );
}

function latestTimestamp(values: readonly string[]): string {
  return (
    [...values].sort((left, right) => right.localeCompare(left))[0] ??
    createEmptyRoutineConversationState().lastUpdatedAt
  );
}

function migrateV1(
  value: z.output<typeof LegacyEnvelopeV1Schema>,
): StorageEnvelope {
  let requestDraft = createEmptyRoutineRequestDraft();

  // A current plan is the oldest reliable full snapshot. Manual setup state is
  // layered next, and the chat profile last because it represents later turns.
  requestDraft = mergeLegacyProfile(
    requestDraft,
    value.currentRoutine?.request ?? null,
  );
  requestDraft = mergeLegacyProfile(requestDraft, value.setupDraft);
  requestDraft = mergeLegacyProfile(
    requestDraft,
    value.conversation.structuredProfile,
  );

  const timestamps = [
    ...value.routines.map((routine) => routine.updatedAt),
    ...value.conversation.messages.map((message) => message.createdAt),
    ...(value.currentRoutine ? [value.currentRoutine.updatedAt] : []),
  ];
  const currentSafety = value.currentRoutine
    ? {
        signals: [],
        screening: value.currentRoutine.safetyScreening,
        result: evaluateRoutineSafety(
          value.currentRoutine.request,
          value.currentRoutine.safetyScreening,
        ),
      }
    : createEmptyConversationSafetyState();

  return StorageEnvelopeSchema.parse({
    version: CURRENT_VERSION,
    routines: value.routines,
    conversationState: {
      messages: value.conversation.messages,
      requestDraft,
      limitationsConfirmation: value.conversation.limitationsConfirmation,
      missingFields: [],
      completionPercentage: 0,
      safety: currentSafety,
      currentRoutine: value.currentRoutine,
      providerState: createIdleAiProviderState(),
      retryMetadata: null,
      lastUpdatedAt: latestTimestamp(timestamps),
    },
    mediaPlaybackPreference: value.mediaPlaybackPreference,
  });
}

function migrateV0(
  value: z.output<typeof LegacyEnvelopeV0Schema>,
): StorageEnvelope {
  const requestDraft = mergeLegacyProfile(
    createEmptyRoutineRequestDraft(),
    value.draft,
  );
  return StorageEnvelopeSchema.parse({
    version: CURRENT_VERSION,
    routines: value.routines,
    conversationState: {
      ...createEmptyRoutineConversationState(
        latestTimestamp(value.routines.map((routine) => routine.updatedAt)),
      ),
      requestDraft,
    },
    mediaPlaybackPreference: "system",
  });
}

function tryMigrateEnvelope(value: unknown): StorageEnvelope | null {
  const current = StorageEnvelopeSchema.safeParse(value);
  if (current.success) return current.data;

  const legacyV1 = LegacyEnvelopeV1Schema.safeParse(value);
  if (legacyV1.success) return migrateV1(legacyV1.data);

  const legacyV0 = LegacyEnvelopeV0Schema.safeParse(value);
  if (legacyV0.success) return migrateV0(legacyV0.data);

  return null;
}

export interface RoutineRepository {
  list(): Promise<SavedRoutine[]>;
  get(id: string): Promise<SavedRoutine | null>;
  save(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<SavedRoutine>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;

  loadRoutineConversationState(): Promise<RoutineConversationState>;
  saveRoutineConversationState(
    state: RoutineConversationState,
  ): Promise<RoutineConversationState>;
  updateRoutineConversationState(
    update: RoutineConversationStateUpdate,
  ): Promise<RoutineConversationState>;
  clearRoutineConversationState(): Promise<void>;

  /** @deprecated Use loadRoutineConversationState. */
  loadSetupDraft(): Promise<RoutineDraft | null>;
  /** @deprecated Use updateRoutineConversationState. */
  saveSetupDraft(draft: RoutineDraft): Promise<void>;
  /** @deprecated Use updateRoutineConversationState. */
  clearSetupDraft(): Promise<void>;
  /** @deprecated Use loadRoutineConversationState. */
  loadCurrentRoutine(): Promise<CurrentRoutine | null>;
  /** @deprecated Use updateRoutineConversationState. */
  saveCurrentRoutine(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<CurrentRoutine>;
  /** @deprecated Use updateRoutineConversationState. */
  clearCurrentRoutine(): Promise<void>;
  /** @deprecated Use loadRoutineConversationState. */
  loadConversation(): Promise<ConversationState>;
  /** @deprecated Use updateRoutineConversationState. */
  saveConversation(state: ConversationState): Promise<void>;

  loadMediaPlaybackPreference(): Promise<MediaPlaybackPreference>;
  saveMediaPlaybackPreference(preference: MediaPlaybackPreference): Promise<void>;
}

export class LocalRoutineRepository implements RoutineRepository {
  constructor(
    private readonly storage: StorageDriver,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<SavedRoutine[]> {
    return [...this.read().routines].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  }

  async get(id: string): Promise<SavedRoutine | null> {
    return this.read().routines.find((routine) => routine.id === id) ?? null;
  }

  async save(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<SavedRoutine> {
    const validatedRequest = RoutineRequestSchema.parse(request);
    const validatedPlan = RoutinePlanSchema.parse(plan);
    const validatedSafety = SafetyScreeningSchema.parse(safetyScreening);
    const envelope = this.read();
    const existing = envelope.routines.find((routine) => routine.id === plan.id);
    const timestamp = this.now().toISOString();
    const saved = SavedRoutineSchema.parse({
      id: validatedPlan.id,
      request: validatedRequest,
      plan: validatedPlan,
      safetyScreening: validatedSafety,
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    envelope.routines = [
      saved,
      ...envelope.routines.filter((routine) => routine.id !== saved.id),
    ];
    this.write(envelope);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const envelope = this.read();
    envelope.routines = envelope.routines.filter((routine) => routine.id !== id);
    this.write(envelope);
  }

  async clear(): Promise<void> {
    this.storage.removeItem(STORAGE_KEY);
    this.storage.removeItem(LEGACY_STORAGE_KEY);
  }

  async loadRoutineConversationState(): Promise<RoutineConversationState> {
    return structuredClone(this.read().conversationState);
  }

  async saveRoutineConversationState(
    state: RoutineConversationState,
  ): Promise<RoutineConversationState> {
    const parsed = RoutineConversationStateSchema.parse(state);
    return this.updateConversationState({
      messages: parsed.messages,
      requestDraft: parsed.requestDraft,
      limitationsConfirmation: parsed.limitationsConfirmation,
      safety: parsed.safety,
      currentRoutine: parsed.currentRoutine,
      providerState: parsed.providerState,
      retryMetadata: parsed.retryMetadata,
    });
  }

  async updateRoutineConversationState(
    update: RoutineConversationStateUpdate,
  ): Promise<RoutineConversationState> {
    return this.updateConversationState(update);
  }

  async clearRoutineConversationState(): Promise<void> {
    const envelope = this.read();
    envelope.conversationState = createEmptyRoutineConversationState(
      this.now().toISOString(),
    );
    this.write(envelope);
  }

  async loadSetupDraft(): Promise<RoutineDraft | null> {
    const draft = this.read().conversationState.requestDraft;
    return isEmptyDraft(draft) ? null : draftToLegacyProfile(draft);
  }

  async saveSetupDraft(draft: RoutineDraft): Promise<void> {
    const validated = RoutineRequestSchema.partial().parse(draft);
    await this.updateConversationState((current) => ({
      requestDraft: mergeLegacyProfile(current.requestDraft, validated),
    }));
  }

  async clearSetupDraft(): Promise<void> {
    await this.updateConversationState({
      requestDraft: createEmptyRoutineRequestDraft(),
      limitationsConfirmation: "not_confirmed",
      safety: createEmptyConversationSafetyState(),
      providerState: createIdleAiProviderState(),
      retryMetadata: null,
    });
  }

  async loadCurrentRoutine(): Promise<CurrentRoutine | null> {
    return structuredClone(this.read().conversationState.currentRoutine);
  }

  async saveCurrentRoutine(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<CurrentRoutine> {
    const timestamp = this.now().toISOString();
    const validatedRequest = RoutineRequestSchema.parse(request);
    const validatedSafety = SafetyScreeningSchema.parse(safetyScreening);
    const currentRoutine = CurrentRoutineSchema.parse({
      request: validatedRequest,
      plan,
      safetyScreening: validatedSafety,
      updatedAt: timestamp,
    });
    const hasDeclaredLimitations =
      validatedRequest.limitations.length > 0 ||
      Object.entries(validatedSafety).some(
        ([key, value]) => key !== "confirmedCurrentStatus" && value,
      );

    await this.updateConversationState(
      {
        requestDraft: RoutineRequestDraftSchema.parse(validatedRequest),
        limitationsConfirmation: validatedSafety.confirmedCurrentStatus
          ? hasDeclaredLimitations
            ? "confirmed_with_limitations"
            : "confirmed_none"
          : "not_confirmed",
        safety: {
          signals: [],
          screening: validatedSafety,
          result: evaluateRoutineSafety(validatedRequest, validatedSafety),
        },
        currentRoutine,
      },
      timestamp,
    );
    return currentRoutine;
  }

  async clearCurrentRoutine(): Promise<void> {
    await this.updateConversationState({ currentRoutine: null });
  }

  async loadConversation(): Promise<ConversationState> {
    const state = this.read().conversationState;
    return ConversationStateSchema.parse({
      messages: state.messages,
      structuredProfile: draftToLegacyProfile(state.requestDraft),
      limitationsConfirmation: state.limitationsConfirmation,
    });
  }

  async saveConversation(state: ConversationState): Promise<void> {
    const validated = ConversationStateSchema.parse(state);
    await this.updateConversationState((current) => ({
      messages: validated.messages,
      requestDraft: mergeLegacyProfile(
        current.requestDraft,
        validated.structuredProfile,
      ),
      limitationsConfirmation: validated.limitationsConfirmation,
    }));
  }

  async loadMediaPlaybackPreference(): Promise<MediaPlaybackPreference> {
    return this.read().mediaPlaybackPreference;
  }

  async saveMediaPlaybackPreference(
    preference: MediaPlaybackPreference,
  ): Promise<void> {
    const envelope = this.read();
    envelope.mediaPlaybackPreference = MediaPlaybackPreferenceSchema.parse(
      preference,
    );
    this.write(envelope);
  }

  private updateConversationState(
    update: RoutineConversationStateUpdate,
    timestamp = this.now().toISOString(),
  ): RoutineConversationState {
    const envelope = this.read();
    const current = structuredClone(envelope.conversationState);
    const patch: RoutineConversationStatePatch =
      typeof update === "function" ? update(current) : update;
    const next = RoutineConversationStateSchema.parse({
      ...current,
      ...patch,
      lastUpdatedAt: timestamp,
    });
    envelope.conversationState = next;
    this.write(envelope);
    return structuredClone(next);
  }

  private read(): StorageEnvelope {
    const candidates = [
      [STORAGE_KEY, this.storage.getItem(STORAGE_KEY)],
      [LEGACY_STORAGE_KEY, this.storage.getItem(LEGACY_STORAGE_KEY)],
    ] as const;

    for (const [key, serialized] of candidates) {
      if (!serialized) continue;
      try {
        const migrated = tryMigrateEnvelope(JSON.parse(serialized));
        if (!migrated) continue;
        const normalized = JSON.stringify(migrated);
        if (key !== STORAGE_KEY || normalized !== serialized) {
          this.storage.setItem(STORAGE_KEY, normalized);
        }
        if (key === LEGACY_STORAGE_KEY) {
          this.storage.removeItem(LEGACY_STORAGE_KEY);
        }
        return migrated;
      } catch {
        // Try the legacy key before recovering with a fresh in-memory envelope.
      }
    }

    return createEmptyEnvelope();
  }

  private write(envelope: StorageEnvelope): void {
    const validated = StorageEnvelopeSchema.parse(envelope);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(validated));
    this.storage.removeItem(LEGACY_STORAGE_KEY);
  }
}

export function migrateEnvelope(value: unknown): StorageEnvelope {
  return tryMigrateEnvelope(value) ?? createEmptyEnvelope();
}

export {
  CURRENT_VERSION as ROUTINE_STORAGE_VERSION,
  LEGACY_STORAGE_KEY as ROUTINE_LEGACY_STORAGE_KEY,
  STORAGE_KEY as ROUTINE_STORAGE_KEY,
};

export type { ConversationMessage, CurrentRoutine };
