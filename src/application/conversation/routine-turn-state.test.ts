import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
import { ParsedRoutineTurnSchema } from "../../ai/schemas/routine-request";
import {
  applyParsedRoutineTurn,
  deriveMissingFields,
  deriveParseStatus,
  deriveProfileCompletion,
  mergeRoutineRequestPatch,
  toCompleteRoutineRequest,
} from "./routine-turn-state";

describe("routine conversation turn state", () => {
  it("accepts a greeting with an empty patch without changing canonical state", () => {
    const current = createEmptyRoutineRequestDraft();
    const result = applyParsedRoutineTurn(current, "not_confirmed", {
      intent: "greeting",
      requestPatch: {},
      limitationsConfirmation: "unknown",
      safetySignals: [],
      assumptions: [],
    });

    expect(result.requestDraft).toEqual(current);
    expect(result.limitationsConfirmation).toBe("not_confirmed");
    expect(result.status).toBe("needs_input");
    expect(result.completionPercentage).toBe(0);
  });

  it("merges information across turns while preserving absent keys", () => {
    const initial = createEmptyRoutineRequestDraft();
    const first = applyParsedRoutineTurn(initial, "not_confirmed", {
      intent: "provide_information",
      requestPatch: {
        goal: "hypertrophy",
        focusMuscles: ["biceps"],
      },
      limitationsConfirmation: "unknown",
      safetySignals: [],
      assumptions: [],
    });
    const second = applyParsedRoutineTurn(
      first.requestDraft,
      first.limitationsConfirmation,
      {
        intent: "provide_information",
        requestPatch: {
          experience: "intermediate",
          daysPerWeek: 4,
          trainingLocation: "commercial_gym",
        },
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
    );

    expect(second.requestDraft).toMatchObject({
      goal: "hypertrophy",
      focusMuscles: ["biceps"],
      experience: "intermediate",
      daysPerWeek: 4,
      trainingLocation: "commercial_gym",
    });
    expect(second.missingFields).toEqual([
      "sessionMinutes",
      "limitationsConfirmation",
    ]);
    expect(second.completionPercentage).toBe(67);
  });

  it("completes canonical state and then applies an explicit correction", () => {
    const draft = mergeRoutineRequestPatch(createEmptyRoutineRequestDraft(), {
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 60,
      trainingLocation: "commercial_gym",
      availableEquipment: ["dumbbell", "machine"],
      focusMuscles: ["biceps"],
    });
    const completed = applyParsedRoutineTurn(draft, "not_confirmed", {
      intent: "provide_information",
      requestPatch: {},
      limitationsConfirmation: "no_limitations",
      safetySignals: [],
      assumptions: [],
    });

    expect(completed.status).toBe("complete");
    expect(completed.completionPercentage).toBe(100);
    expect(
      toCompleteRoutineRequest(
        completed.requestDraft,
        completed.limitationsConfirmation,
      ),
    ).toMatchObject({ daysPerWeek: 4, goal: "hypertrophy" });

    const corrected = applyParsedRoutineTurn(
      completed.requestDraft,
      completed.limitationsConfirmation,
      {
        intent: "modify_profile",
        requestPatch: { daysPerWeek: 3 },
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
    );
    expect(corrected.requestDraft.daysPerWeek).toBe(3);
    expect(corrected.requestDraft.goal).toBe("hypertrophy");
    expect(corrected.status).toBe("complete");
  });

  it("uses null as an explicit clear operation", () => {
    const current = mergeRoutineRequestPatch(createEmptyRoutineRequestDraft(), {
      focusMuscles: ["back", "biceps"],
      notes: "Evitar alta fatiga.",
    });
    expect(
      mergeRoutineRequestPatch(current, {
        focusMuscles: null,
        notes: null,
      }),
    ).toMatchObject({ focusMuscles: [], notes: null });
  });

  it("derives completion and a custom location from explicit equipment", () => {
    const draft = mergeRoutineRequestPatch(createEmptyRoutineRequestDraft(), {
      goal: "general_fitness",
      experience: "beginner",
      daysPerWeek: 2,
      sessionMinutes: 40,
      availableEquipment: ["dumbbell"],
    });

    expect(deriveMissingFields(draft, "confirmed_none")).toEqual([]);
    expect(deriveProfileCompletion(draft, "confirmed_none")).toBe(100);
    expect(toCompleteRoutineRequest(draft, "confirmed_none")).toMatchObject({
      trainingLocation: "custom",
      availableEquipment: ["dumbbell"],
    });
  });

  it("conservatively derives an unsupported status from validated safety signals", () => {
    const draft = createEmptyRoutineRequestDraft();
    expect(
      deriveParseStatus(draft, "not_confirmed", ["recent_injury"]),
    ).toBe("unsupported");
  });

  it("rejects malformed or unknown model patch fields without partial merging", () => {
    const malformed = ParsedRoutineTurnSchema.safeParse({
      intent: "provide_information",
      requestPatch: { daysPerWeek: 9, inventedField: true },
      limitationsConfirmation: "unknown",
      safetySignals: [],
      assumptions: [],
    });
    expect(malformed.success).toBe(false);
    expect(createEmptyRoutineRequestDraft()).toEqual(
      createEmptyRoutineRequestDraft(),
    );
  });
});
