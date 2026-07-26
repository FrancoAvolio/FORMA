import { z } from "zod";

import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "@/domain/profile/routine-request";
import { RoutinePlanSchema, type RoutinePlan } from "@/domain/routine/schemas";
import {
  SafetyScreeningSchema,
  type SafetyScreening,
} from "@/domain/safety/schemas";

import type { StorageDriver } from "./storage-driver";

const STORAGE_KEY = "forma:routines:v1";
const CURRENT_VERSION = 1 as const;

export const SavedRoutineSchema = z.object({
  id: z.string().trim().min(1),
  request: RoutineRequestSchema,
  plan: RoutinePlanSchema,
  safetyScreening: SafetyScreeningSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const CurrentRoutineSchema = z.object({
  request: RoutineRequestSchema,
  plan: RoutinePlanSchema,
  safetyScreening: SafetyScreeningSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export const ConversationMessageSchema = z.object({
  id: z.string().trim().min(1).max(160),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4_000),
  createdAt: z.string().datetime({ offset: true }),
});

export const ConversationStateSchema = z.object({
  messages: z.array(ConversationMessageSchema).max(100),
  structuredProfile: RoutineRequestSchema.partial(),
  limitationsConfirmation: z
    .enum(["not_confirmed", "confirmed_none", "confirmed_with_limitations"])
    .default("not_confirmed"),
});

export const MediaPlaybackPreferenceSchema = z.enum([
  "system",
  "static",
  "animated",
  "reduced_motion",
]);

export type SavedRoutine = z.infer<typeof SavedRoutineSchema>;
export type CurrentRoutine = z.infer<typeof CurrentRoutineSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type ConversationState = z.infer<typeof ConversationStateSchema>;
export type MediaPlaybackPreference = z.infer<typeof MediaPlaybackPreferenceSchema>;
export type RoutineDraft = Partial<RoutineRequest>;

const StorageEnvelopeSchema = z.object({
  version: z.literal(CURRENT_VERSION),
  routines: z.array(SavedRoutineSchema),
  setupDraft: RoutineRequestSchema.partial().nullable(),
  currentRoutine: CurrentRoutineSchema.nullable(),
  conversation: ConversationStateSchema,
  mediaPlaybackPreference: MediaPlaybackPreferenceSchema,
});

type StorageEnvelope = z.infer<typeof StorageEnvelopeSchema>;

const EMPTY_ENVELOPE: StorageEnvelope = {
  version: CURRENT_VERSION,
  routines: [],
  setupDraft: null,
  currentRoutine: null,
  conversation: {
    messages: [],
    structuredProfile: {},
    limitationsConfirmation: "not_confirmed",
  },
  mediaPlaybackPreference: "system",
};

/**
 * Pre-release migration shape retained so the migration boundary is exercised from day one.
 * It matches the first internal persistence prototype and adds the later state buckets.
 */
const LegacyEnvelopeV0Schema = z.object({
  version: z.literal(0),
  routines: z.array(SavedRoutineSchema),
  draft: RoutineRequestSchema.partial().nullable(),
});

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
  loadSetupDraft(): Promise<RoutineDraft | null>;
  saveSetupDraft(draft: RoutineDraft): Promise<void>;
  clearSetupDraft(): Promise<void>;
  loadCurrentRoutine(): Promise<CurrentRoutine | null>;
  saveCurrentRoutine(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<CurrentRoutine>;
  clearCurrentRoutine(): Promise<void>;
  loadConversation(): Promise<ConversationState>;
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
  }

  async loadSetupDraft(): Promise<RoutineDraft | null> {
    return this.read().setupDraft;
  }

  async saveSetupDraft(draft: RoutineDraft): Promise<void> {
    const envelope = this.read();
    envelope.setupDraft = RoutineRequestSchema.partial().parse(draft);
    this.write(envelope);
  }

  async clearSetupDraft(): Promise<void> {
    const envelope = this.read();
    envelope.setupDraft = null;
    this.write(envelope);
  }

  async loadCurrentRoutine(): Promise<CurrentRoutine | null> {
    return this.read().currentRoutine;
  }

  async saveCurrentRoutine(
    request: RoutineRequest,
    plan: RoutinePlan,
    safetyScreening: SafetyScreening,
  ): Promise<CurrentRoutine> {
    const currentRoutine = CurrentRoutineSchema.parse({
      request,
      plan,
      safetyScreening,
      updatedAt: this.now().toISOString(),
    });
    const envelope = this.read();
    envelope.currentRoutine = currentRoutine;
    this.write(envelope);
    return currentRoutine;
  }

  async clearCurrentRoutine(): Promise<void> {
    const envelope = this.read();
    envelope.currentRoutine = null;
    this.write(envelope);
  }

  async loadConversation(): Promise<ConversationState> {
    return this.read().conversation;
  }

  async saveConversation(state: ConversationState): Promise<void> {
    const envelope = this.read();
    envelope.conversation = ConversationStateSchema.parse(state);
    this.write(envelope);
  }

  async loadMediaPlaybackPreference(): Promise<MediaPlaybackPreference> {
    return this.read().mediaPlaybackPreference;
  }

  async saveMediaPlaybackPreference(
    preference: MediaPlaybackPreference,
  ): Promise<void> {
    const envelope = this.read();
    envelope.mediaPlaybackPreference = MediaPlaybackPreferenceSchema.parse(preference);
    this.write(envelope);
  }

  private read(): StorageEnvelope {
    const serialized = this.storage.getItem(STORAGE_KEY);
    if (!serialized) {
      return structuredClone(EMPTY_ENVELOPE);
    }

    try {
      return migrateEnvelope(JSON.parse(serialized));
    } catch {
      return structuredClone(EMPTY_ENVELOPE);
    }
  }

  private write(envelope: StorageEnvelope): void {
    const validated = StorageEnvelopeSchema.parse(envelope);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  }
}

export function migrateEnvelope(value: unknown): StorageEnvelope {
  const current = StorageEnvelopeSchema.safeParse(value);
  if (current.success) {
    return current.data;
  }

  const legacy = LegacyEnvelopeV0Schema.safeParse(value);
  if (legacy.success) {
    return StorageEnvelopeSchema.parse({
      ...EMPTY_ENVELOPE,
      routines: legacy.data.routines,
      setupDraft: legacy.data.draft,
    });
  }

  return structuredClone(EMPTY_ENVELOPE);
}

export { CURRENT_VERSION as ROUTINE_STORAGE_VERSION, STORAGE_KEY as ROUTINE_STORAGE_KEY };
