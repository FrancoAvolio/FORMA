import { describe, expect, it } from "vitest";

import {
  createEmptyRoutineRequestDraft,
  type LimitationsConfirmation,
} from "../../domain/profile/routine-draft";
import {
  type ConversationalSafetyScreeningDraft,
} from "../../domain/safety/conversational-screening";
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
    const completed = applyParsedRoutineTurn(
      draft,
      "not_confirmed",
      {
        intent: "provide_information",
        requestPatch: {},
        limitationsConfirmation: "no_limitations",
        safetySignals: [],
        assumptions: [],
      },
      {
        rawMessage:
          "No tengo dolor, lesiones, operaciones, restricciones médicas, síntomas ni indicaciones profesionales.",
      },
    );

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
      { screeningDraft: completed.screeningDraft },
    );
    expect(corrected.requestDraft.daysPerWeek).toBe(3);
    expect(corrected.requestDraft.goal).toBe("hypertrophy");
    expect(corrected.status).toBe("complete");
  });

  it("accepts only the deterministic field when the model claims a broad all-clear", () => {
    const result = applyParsedRoutineTurn(
      createEmptyRoutineRequestDraft(),
      "not_confirmed",
      {
        intent: "provide_information",
        requestPatch: {},
        limitationsConfirmation: "no_limitations",
        safetySignals: [],
        assumptions: [],
      },
      {
        rawMessage: "No tengo dolor.",
      },
    );

    expect(result.screeningDraft).toMatchObject({
      painDuringMovement: false,
      recentInjury: null,
      recentOperation: null,
      medicalRestriction: null,
    });
    expect(result.safetyMissingFields).toHaveLength(5);
    expect(result.limitationsConfirmation).toBe("not_confirmed");
  });

  it("merges a conversational safety sequence without repeating answered fields", () => {
    const messages = [
      "No tengo ninguna restricción para entrenar.",
      "No tengo dolor ni síntomas cuando entreno.",
      "No tuve lesiones ni operaciones recientes.",
      "No recibí indicaciones profesionales.",
    ];
    let draft = createEmptyRoutineRequestDraft();
    let screeningDraft: ConversationalSafetyScreeningDraft | undefined;
    let confirmation: LimitationsConfirmation = "not_confirmed";
    let latest;
    for (const message of messages) {
      latest = applyParsedRoutineTurn(
        draft,
        confirmation,
        {
          intent: "provide_information",
          requestPatch: {},
          limitationsConfirmation: "unknown",
          safetySignals: [],
          assumptions: [],
        },
        { rawMessage: message, screeningDraft },
      );
      draft = latest.requestDraft;
      screeningDraft = latest.screeningDraft;
      confirmation = latest.limitationsConfirmation;
    }

    expect(latest?.safetyMissingFields).toEqual([]);
    expect(latest?.safetyStatus).toBe("eligible");
    expect(latest?.limitationsConfirmation).toBe("confirmed_none");
  });

  it("accepts a scoped contextual No without depending on model clearance", () => {
    const result = applyParsedRoutineTurn(
      createEmptyRoutineRequestDraft(),
      "not_confirmed",
      {
        intent: "provide_information",
        requestPatch: {},
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
      {
        rawMessage: "No",
        contextualSafetyPatch: {
          painDuringMovement: false,
          recentInjury: false,
          recentOperation: false,
          medicalRestriction: false,
          symptomsDuringExercise: false,
          professionalInstructionsAffectTraining: false,
        },
      },
    );

    expect(result.safetyMissingFields).toEqual([]);
    expect(result.safetyStatus).toBe("eligible");
    expect(result.limitationsConfirmation).toBe("confirmed_none");
  });

  it("keeps explicit positive evidence authoritative over contextual negatives", () => {
    const result = applyParsedRoutineTurn(
      createEmptyRoutineRequestDraft(),
      "not_confirmed",
      {
        intent: "unsupported",
        requestPatch: {},
        limitationsConfirmation: "has_limitations",
        safetySignals: ["pain_during_movement"],
        assumptions: [],
      },
      {
        rawMessage: "No, pero tengo dolor al moverme.",
        contextualSafetyPatch: {
          painDuringMovement: false,
          recentInjury: false,
          recentOperation: false,
          medicalRestriction: false,
          symptomsDuringExercise: false,
          professionalInstructionsAffectTraining: false,
        },
      },
    );

    expect(result.screeningDraft.painDuringMovement).toBe(true);
    expect(result.safetyStatus).toBe("blocked");
    expect(result.status).toBe("unsupported");
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
