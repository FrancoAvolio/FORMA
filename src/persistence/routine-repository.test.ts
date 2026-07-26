import { describe, expect, it } from "vitest";

import type { RoutineRequest } from "@/domain/profile/routine-request";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { SafetyScreening } from "@/domain/safety/schemas";

import { LocalRoutineRepository, ROUTINE_STORAGE_KEY } from "./routine-repository";
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
    expect((await repository.get(plan.id))?.plan.summary).toBe("Rutina actualizada.");
  });

  it("stores the current plan and all non-routine preference buckets", async () => {
    const repository = new LocalRoutineRepository(new MemoryStorage());

    await repository.saveSetupDraft({ goal: "strength", daysPerWeek: 4 });
    await repository.saveCurrentRoutine(request, plan, safetyScreening);
    await repository.saveConversation({
      messages: [],
      structuredProfile: { goal: "strength" },
      limitationsConfirmation: "confirmed_none",
    });
    await repository.saveMediaPlaybackPreference("reduced_motion");

    expect(await repository.loadSetupDraft()).toEqual({
      goal: "strength",
      daysPerWeek: 4,
    });
    expect((await repository.loadCurrentRoutine())?.plan.id).toBe(plan.id);
    expect((await repository.loadConversation()).structuredProfile.goal).toBe("strength");
    expect((await repository.loadConversation()).limitationsConfirmation).toBe(
      "confirmed_none",
    );
    expect(await repository.loadMediaPlaybackPreference()).toBe("reduced_motion");
  });

  it("migrates a version-zero envelope and can delete all local data", async () => {
    const storage = new MemoryStorage();
    const saved = {
      id: plan.id,
      request,
      plan,
      safetyScreening,
      createdAt: "2026-07-25T12:00:00.000Z",
      updatedAt: "2026-07-25T12:00:00.000Z",
    };
    storage.setItem(
      ROUTINE_STORAGE_KEY,
      JSON.stringify({ version: 0, routines: [saved], draft: { goal: "strength" } }),
    );
    const repository = new LocalRoutineRepository(storage);

    expect(await repository.list()).toHaveLength(1);
    expect(await repository.loadSetupDraft()).toEqual({ goal: "strength" });

    await repository.clear();
    expect(storage.getItem(ROUTINE_STORAGE_KEY)).toBeNull();
  });

  it("recovers safely from malformed or unsupported storage", async () => {
    const storage = new MemoryStorage();
    storage.setItem(ROUTINE_STORAGE_KEY, "not-json");
    const repository = new LocalRoutineRepository(storage);

    expect(await repository.list()).toEqual([]);
    expect(await repository.loadSetupDraft()).toBeNull();
    expect(await repository.loadMediaPlaybackPreference()).toBe("system");
  });
});
