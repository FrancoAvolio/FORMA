import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "@/domain/profile/routine-draft";
import type { RoutineRequest } from "@/domain/profile/routine-request";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { SafetyScreening } from "@/domain/safety/schemas";

import {
  LocalRoutineRepository,
  ROUTINE_LEGACY_STORAGE_KEY,
  ROUTINE_STORAGE_KEY,
  ROUTINE_STORAGE_VERSION,
} from "./routine-repository";
import type { ConversationMessage } from "./routine-conversation-state";
import type { StorageDriver } from "./storage-driver";

class MemoryStorage implements StorageDriver {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const request: RoutineRequest = {
  goal: "hypertrophy",
  experience: "beginner",
  daysPerWeek: 3,
  sessionMinutes: 60,
  trainingLocation: "home",
  availableEquipment: ["dumbbell"],
  focusMuscles: [],
  excludedExercises: [],
  excludedMovementPatterns: [],
  preferredExercises: [],
  limitations: [],
  notes: null,
};

const safetyScreening: SafetyScreening = {
  confirmedCurrentStatus: true,
  painDuringMovement: false,
  recentInjury: false,
  recentOperation: false,
  medicalRestriction: false,
  symptomsDuringExercise: false,
  professionalInstructionsAffectTraining: false,
};

const plan: RoutinePlan = {
  id: "plan-1",
  title: "Plan de hipertrofia",
  goal: "hypertrophy",
  daysPerWeek: 3,
  summary: "Tres sesiones de cuerpo completo.",
  splitId: "full-body-3",
  splitName: "Cuerpo completo",
  days: [
    {
      id: "day-1",
      name: "Día 1",
      focus: ["cuerpo completo"],
      estimatedMinutes: 55,
      exercises: [
        {
          exerciseId: "exercise-1",
          sets: 3,
          repPrescription: "8-12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: [],
          selectionReasons: ["Coincide con el equipamiento disponible."],
        },
      ],
    },
  ],
  warnings: [],
  assumptions: ["Se asumió disponibilidad regular de mancuernas."],
  generatedAt: "2026-07-25T12:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "test",
  seed: "test-seed",
};

const userMessage: ConversationMessage = {
  id: "message-user-1",
  role: "user",
  content: "Quiero priorizar bíceps.",
  createdAt: "2026-07-28T12:00:00.000Z",
};

function savedRoutineFixture() {
  return {
    id: plan.id,
    request,
    plan,
    safetyScreening,
    createdAt: "2026-07-25T12:00:00.000Z",
    updatedAt: "2026-07-25T12:00:00.000Z",
  };
}

describe("LocalRoutineRepository", () => {
  it("persists a validated routine and preserves its creation timestamp on updates", async () => {
    const storage = new MemoryStorage();
    const times = [
      new Date("2026-07-25T12:00:00.000Z"),
      new Date("2026-07-26T12:00:00.000Z"),
    ];
    const repository = new LocalRoutineRepository(storage, () => times.shift()!);

    const first = await repository.save(request, plan, safetyScreening);
    const updated = await repository.save(
      request,
      { ...plan, summary: "Rutina actualizada." },
      safetyScreening,
    );

    expect(await repository.list()).toHaveLength(1);
    expect(updated.createdAt).toBe(first.createdAt);
    expect(updated.updatedAt).not.toBe(first.updatedAt);
    expect((await repository.get(plan.id))?.plan.summary).toBe(
      "Rutina actualizada.",
    );
  });

  it("exposes chat updates to the form from the same canonical draft", async () => {
    const repository = new LocalRoutineRepository(new MemoryStorage(), () =>
      new Date("2026-07-28T12:05:00.000Z"),
    );

    const canonical = await repository.updateRoutineConversationState(
      (current) => ({
        messages: [userMessage],
        requestDraft: {
          ...current.requestDraft,
          goal: "hypertrophy",
          daysPerWeek: 4,
          focusMuscles: ["biceps"],
        },
        limitationsConfirmation: "not_confirmed",
      }),
    );

    expect(canonical.missingFields).toEqual([
      "experience",
      "sessionMinutes",
      "trainingLocationOrEquipment",
      "limitationsConfirmation",
    ]);
    expect(canonical.completionPercentage).toBe(33);
    expect(await repository.loadSetupDraft()).toMatchObject({
      goal: "hypertrophy",
      daysPerWeek: 4,
      focusMuscles: ["biceps"],
    });
    expect((await repository.loadConversation()).messages).toEqual([
      userMessage,
    ]);
  });

  it("exposes manual form edits back to chat without losing prior messages", async () => {
    const repository = new LocalRoutineRepository(new MemoryStorage());
    await repository.updateRoutineConversationState({ messages: [userMessage] });

    await repository.saveSetupDraft({
      goal: "strength",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 50,
      trainingLocation: "commercial_gym",
      availableEquipment: ["barbell", "machine"],
      focusMuscles: ["back"],
    });
    await repository.saveConversation({
      messages: [userMessage],
      structuredProfile: { notes: "Mantener sesiones compactas." },
      limitationsConfirmation: "confirmed_none",
    });

    const canonical = await repository.loadRoutineConversationState();
    expect(canonical.messages).toEqual([userMessage]);
    expect(canonical.requestDraft).toMatchObject({
      goal: "strength",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 50,
      trainingLocation: "commercial_gym",
      availableEquipment: ["barbell", "machine"],
      focusMuscles: ["back"],
      notes: "Mantener sesiones compactas.",
    });
    expect(canonical.limitationsConfirmation).toBe("confirmed_none");
    expect(canonical.missingFields).toEqual([]);
    expect(canonical.completionPercentage).toBe(100);
  });

  it("preserves the validated plan and profile when a provider turn fails", async () => {
    const repository = new LocalRoutineRepository(new MemoryStorage(), () =>
      new Date("2026-07-28T12:10:00.000Z"),
    );
    await repository.saveCurrentRoutine(request, plan, safetyScreening);
    const before = await repository.loadRoutineConversationState();

    const failed = await repository.updateRoutineConversationState((current) => ({
      messages: [...current.messages, userMessage],
      providerState: {
        status: "error",
        providerId: "ollama",
        model: "qwen3:1.7b",
        error: {
          code: "invalid_output",
          title: "El modelo no pudo estructurar el mensaje",
          message: "Podés reintentar sin perder tu progreso.",
          canRetry: true,
        },
      },
      retryMetadata: {
        lastUserMessageId: userMessage.id,
        failedAt: "2026-07-28T12:10:00.000Z",
        attemptCount: 1,
      },
    }));

    expect(failed.currentRoutine).toEqual(before.currentRoutine);
    expect(failed.requestDraft).toEqual(before.requestDraft);
    expect(failed.safety).toEqual(before.safety);
    expect(failed.retryMetadata?.lastUserMessageId).toBe(userMessage.id);
    expect((await repository.loadCurrentRoutine())?.plan).toEqual(plan);
  });

  it("fails closed when a new safety signal makes an older eligible result stale", async () => {
    const repository = new LocalRoutineRepository(new MemoryStorage());
    const state = await repository.updateRoutineConversationState({
      safety: {
        signals: ["recent_injury"],
        screening: safetyScreening,
        result: {
          allowed: true,
          classification: "eligible",
          reasonCodes: [],
          message: "Apto para generar.",
        },
      },
    });

    expect(state.safety).toEqual({
      signals: ["recent_injury"],
      screening: null,
      result: null,
    });
    expect((await repository.loadRoutineConversationState()).safety).toEqual(
      state.safety,
    );
  });

  it("migrates v0 data from the legacy key and removes only the obsolete envelope", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ROUTINE_LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        routines: [savedRoutineFixture()],
        draft: { goal: "strength", focusMuscles: ["back"] },
      }),
    );
    const repository = new LocalRoutineRepository(storage);

    expect(await repository.list()).toHaveLength(1);
    expect(await repository.loadSetupDraft()).toMatchObject({
      goal: "strength",
      focusMuscles: ["back"],
    });
    expect(storage.getItem(ROUTINE_LEGACY_STORAGE_KEY)).toBeNull();
    expect(
      (JSON.parse(storage.getItem(ROUTINE_STORAGE_KEY)!) as { version: number })
        .version,
    ).toBe(ROUTINE_STORAGE_VERSION);
  });

  it("merges every non-conflicting v1 bucket into the canonical v2 state", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      ROUTINE_LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        routines: [savedRoutineFixture()],
        setupDraft: {
          goal: "strength",
          daysPerWeek: 4,
          sessionMinutes: 45,
        },
        currentRoutine: {
          request,
          plan,
          safetyScreening,
          updatedAt: "2026-07-26T12:00:00.000Z",
        },
        conversation: {
          messages: [userMessage],
          structuredProfile: {
            experience: "intermediate",
            focusMuscles: ["biceps"],
          },
          limitationsConfirmation: "confirmed_none",
        },
        mediaPlaybackPreference: "animated",
      }),
    );

    const repository = new LocalRoutineRepository(storage);
    const canonical = await repository.loadRoutineConversationState();

    expect(canonical.messages).toEqual([userMessage]);
    expect(canonical.requestDraft).toMatchObject({
      goal: "strength",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 45,
      trainingLocation: "home",
      availableEquipment: ["dumbbell"],
      focusMuscles: ["biceps"],
    });
    expect(canonical.currentRoutine?.plan).toEqual(plan);
    expect(canonical.safety.screening).toEqual(safetyScreening);
    expect(canonical.limitationsConfirmation).toBe("confirmed_none");
    expect(canonical.lastUpdatedAt).toBe(userMessage.createdAt);
    expect(await repository.loadMediaPlaybackPreference()).toBe("animated");
    expect(await repository.list()).toHaveLength(1);
  });

  it("re-derives stale completion data and never restores a persisted loading state", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalRoutineRepository(storage);
    await repository.updateRoutineConversationState((current) => ({
      messages: [userMessage],
      requestDraft: { ...current.requestDraft, goal: "strength" },
    }));

    const envelope = JSON.parse(storage.getItem(ROUTINE_STORAGE_KEY)!) as {
      conversationState: Record<string, unknown>;
    };
    envelope.conversationState["missingFields"] = [];
    envelope.conversationState["completionPercentage"] = 100;
    envelope.conversationState["providerState"] = {
      status: "loading",
      providerId: "ollama",
      model: "qwen3:1.7b",
      error: null,
    };
    storage.setItem(ROUTINE_STORAGE_KEY, JSON.stringify(envelope));

    const reloaded = await new LocalRoutineRepository(
      storage,
    ).loadRoutineConversationState();
    expect(reloaded.missingFields).toEqual([
      "experience",
      "daysPerWeek",
      "sessionMinutes",
      "trainingLocationOrEquipment",
      "limitationsConfirmation",
    ]);
    expect(reloaded.completionPercentage).toBe(17);
    expect(reloaded.providerState).toMatchObject({
      status: "idle",
      providerId: "ollama",
    });

    const normalized = JSON.parse(storage.getItem(ROUTINE_STORAGE_KEY)!) as {
      conversationState: { providerState: { status: string } };
    };
    expect(normalized.conversationState.providerState.status).toBe("idle");
  });

  it("recovers from malformed primary storage and still salvages a valid legacy envelope", async () => {
    const storage = new MemoryStorage();
    storage.setItem(ROUTINE_STORAGE_KEY, "not-json");
    storage.setItem(
      ROUTINE_LEGACY_STORAGE_KEY,
      JSON.stringify({
        version: 0,
        routines: [],
        draft: { goal: "general_fitness" },
      }),
    );

    const repository = new LocalRoutineRepository(storage);
    expect(await repository.loadSetupDraft()).toMatchObject({
      goal: "general_fitness",
    });
    expect(storage.getItem(ROUTINE_LEGACY_STORAGE_KEY)).toBeNull();
  });

  it("recovers safely from wholly malformed storage and can write a fresh state", async () => {
    const storage = new MemoryStorage();
    storage.setItem(ROUTINE_STORAGE_KEY, "not-json");
    const repository = new LocalRoutineRepository(storage);

    const empty = await repository.loadRoutineConversationState();
    expect(empty.requestDraft).toEqual(createEmptyRoutineRequestDraft());
    expect(empty.messages).toEqual([]);
    expect(empty.providerState.status).toBe("idle");
    expect(await repository.loadMediaPlaybackPreference()).toBe("system");

    await repository.saveSetupDraft({ goal: "strength" });
    expect(await repository.loadSetupDraft()).toMatchObject({ goal: "strength" });
  });

  it("deletes saved routines, canonical conversation state, preferences, and legacy data", async () => {
    const storage = new MemoryStorage();
    const repository = new LocalRoutineRepository(storage);
    await repository.save(request, plan, safetyScreening);
    await repository.saveCurrentRoutine(request, plan, safetyScreening);
    await repository.updateRoutineConversationState({ messages: [userMessage] });
    await repository.saveMediaPlaybackPreference("reduced_motion");
    storage.setItem(ROUTINE_LEGACY_STORAGE_KEY, "obsolete");

    await repository.clear();

    expect(storage.getItem(ROUTINE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(ROUTINE_LEGACY_STORAGE_KEY)).toBeNull();
    expect(await repository.list()).toEqual([]);
    expect((await repository.loadRoutineConversationState()).messages).toEqual(
      [],
    );
    expect(await repository.loadCurrentRoutine()).toBeNull();
    expect(await repository.loadMediaPlaybackPreference()).toBe("system");
  });
});
