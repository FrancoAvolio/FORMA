import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
import { applyParsedRoutineTurn } from "./routine-turn-state";
import {
  deriveAssistantSafetyResult,
  reconcileParsedTurnSafety,
  resolveSafetySignalsAfterManualReview,
} from "./deterministic-safety";

const neutralTurn = {
  intent: "provide_information" as const,
  requestPatch: {},
  limitationsConfirmation: "unknown" as const,
  safetySignals: [],
  assumptions: [],
};

describe("deterministic conversational safety", () => {
  it("cannot lose a recent injury omitted by model output", () => {
    const result = reconcileParsedTurnSafety(
      neutralTurn,
      "Me lesioné ayer, armame una rutina",
    );

    expect(result.intent).toBe("unsupported");
    expect(result.safetySignals).toContain("recent_injury");
    expect(result.limitationsConfirmation).toBe("has_limitations");
  });

  it("does not accept a model-only all-clear for an unrelated greeting", () => {
    const result = reconcileParsedTurnSafety(
      { ...neutralTurn, limitationsConfirmation: "no_limitations" },
      "Hola bro",
    );

    expect(result.limitationsConfirmation).toBe("unknown");
  });

  it("accepts an explicit all-clear and derives generation eligibility", () => {
    const result = reconcileParsedTurnSafety(
      neutralTurn,
      "No tengo ninguna lesión ni restricción",
    );

    expect(result.limitationsConfirmation).toBe("no_limitations");
    expect(deriveAssistantSafetyResult("confirmed_none", [])).toEqual({
      status: "clear",
      signals: [],
      generationAllowed: true,
    });
  });

  it("does not treat denial of only pain as a complete safety screening", () => {
    const result = reconcileParsedTurnSafety(neutralTurn, "No tengo dolor");

    expect(result.limitationsConfirmation).toBe("unknown");
    expect(result.safetySignals).toEqual([]);
  });

  it("does not synthesize injury and restriction answers from pain and symptoms", () => {
    const result = reconcileParsedTurnSafety(
      neutralTurn,
      "No tengo dolor ni síntomas",
    );

    expect(result.limitationsConfirmation).toBe("unknown");
  });

  it("discards model-only signals caused by explicitly negated safety terms", () => {
    const result = reconcileParsedTurnSafety(
      {
        ...neutralTurn,
        limitationsConfirmation: "has_limitations",
        safetySignals: ["recent_injury", "pain_during_movement"],
      },
      "No tengo dolor, lesiones, s\u00edntomas ni restricciones",
    );

    expect(result.intent).toBe("provide_information");
    expect(result.safetySignals).toEqual([]);
    expect(result.limitationsConfirmation).toBe("no_limitations");
  });

  it("does not turn a natural Spanish all-clear list into pain or symptom signals", () => {
    const message =
      "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.";
    const result = reconcileParsedTurnSafety(neutralTurn, message);

    expect(result.intent).toBe("provide_information");
    expect(result.safetySignals).toEqual([]);
    expect(result.limitationsConfirmation).toBe("no_limitations");
  });

  it("drops unrelated model fields from a safety-only turn and preserves the profile", () => {
    const profile = {
      ...createEmptyRoutineRequestDraft(),
      goal: "hypertrophy" as const,
      experience: "intermediate" as const,
      daysPerWeek: 4,
      sessionMinutes: 60,
      trainingLocation: "commercial_gym" as const,
      focusMuscles: ["back", "biceps"],
    };
    const message =
      "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.";
    const reconciled = reconcileParsedTurnSafety(
      {
        intent: "modify_profile",
        requestPatch: {
          goal: "general_fitness",
          experience: "advanced",
          daysPerWeek: 5,
          sessionMinutes: 60,
          trainingLocation: "home",
          availableEquipment: [],
          focusMuscles: [],
          excludedExercises: [],
          excludedMovementPatterns: [],
          preferredExercises: [],
          limitations: [],
        },
        limitationsConfirmation: "no_limitations",
        safetySignals: [
          "pain_during_movement",
          "recent_injury",
          "recent_operation",
          "medical_restriction",
          "symptoms_during_exercise",
        ],
        assumptions: [],
      },
      message,
      { hasCurrentRoutine: false },
    );
    const applied = applyParsedRoutineTurn(
      profile,
      "not_confirmed",
      reconciled,
    );

    expect(reconciled).toMatchObject({
      intent: "provide_information",
      requestPatch: {},
      limitationsConfirmation: "no_limitations",
      safetySignals: [],
    });
    expect(applied.requestDraft).toEqual(profile);
    expect(applied.limitationsConfirmation).toBe("confirmed_none");
    expect(applied.status).toBe("complete");
  });

  it("corrects initial modify-routine intent while retaining explicitly supported fields", () => {
    const message =
      "Quiero una rutina de hipertrofia. Soy intermedio, quiero entrenar cuatro días por semana, una hora por sesión, en un gimnasio completo. Quiero priorizar espalda y bíceps.";
    const result = reconcileParsedTurnSafety(
      {
        intent: "modify_routine",
        requestPatch: {
          goal: "hypertrophy",
          experience: "intermediate",
          daysPerWeek: 4,
          sessionMinutes: 60,
          trainingLocation: "commercial_gym",
          focusMuscles: ["back", "biceps"],
        },
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
      message,
      { hasCurrentRoutine: false },
    );

    expect(result.intent).toBe("provide_information");
    expect(result.requestPatch).toEqual({
      goal: "hypertrophy",
      experience: "intermediate",
      daysPerWeek: 4,
      sessionMinutes: 60,
      trainingLocation: "commercial_gym",
      focusMuscles: ["back", "biceps"],
    });
  });

  it("reconciles a false safety label and wrong profile values from an ordinary turn", () => {
    const message =
      "Quiero ganar musculo, puedo entrenar 5 dias a la semana, el equipamiento que cuento es con un gimnasio completo";
    const result = reconcileParsedTurnSafety(
      {
        intent: "modify_routine",
        requestPatch: {
          goal: "general_fitness",
          experience: "intermediate",
          daysPerWeek: 5,
          trainingLocation: "commercial_gym",
          availableEquipment: ["gym_complete"],
        },
        limitationsConfirmation: "unknown",
        safetySignals: ["pain_during_movement"],
        assumptions: [],
      },
      message,
      { hasCurrentRoutine: false },
    );

    expect(result).toMatchObject({
      intent: "provide_information",
      requestPatch: {
        goal: "hypertrophy",
        daysPerWeek: 5,
        trainingLocation: "commercial_gym",
      },
      safetySignals: [],
    });
    expect(result.requestPatch).not.toHaveProperty("experience");
    expect(result.requestPatch).not.toHaveProperty("availableEquipment");
  });

  it("extracts a location when the model returns a greeting with an empty patch", () => {
    const result = reconcileParsedTurnSafety(
      {
        intent: "greeting",
        requestPatch: {},
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
      "Voy a entrenar en un gimnasio publico",
      { hasCurrentRoutine: false },
    );

    expect(result.intent).toBe("provide_information");
    expect(result.requestPatch).toEqual({
      trainingLocation: "commercial_gym",
    });
  });

  it("does not turn generic full-equipment wording into a guessed equipment list", () => {
    const result = reconcileParsedTurnSafety(
      {
        intent: "modify_profile",
        requestPatch: {
          availableEquipment: ["barbell", "dumbbell"],
        },
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      },
      "Cuento con equipamiento completo",
      { hasCurrentRoutine: false },
    );

    expect(result.requestPatch).toEqual({});
  });

  it("does not rewrite routine-modification intent when routine state is unknown", () => {
    const result = reconcileParsedTurnSafety(
      {
        ...neutralTurn,
        intent: "modify_routine",
        requestPatch: {},
      },
      "Cambiame el press inclinado",
    );

    expect(result.intent).toBe("modify_routine");
  });

  it("keeps an unconfirmed empty draft in review", () => {
    expect(createEmptyRoutineRequestDraft().limitations).toEqual([]);
    expect(deriveAssistantSafetyResult("not_confirmed", [])).toMatchObject({
      status: "needs_review",
      generationAllowed: false,
    });
  });

  it("honors an eligible domain assessment with explicit concrete limitations", () => {
    expect(
      deriveAssistantSafetyResult("confirmed_with_limitations", [], {
        allowed: true,
        classification: "eligible",
        reasonCodes: [],
        message: "Restricciones concretas validadas.",
      }),
    ).toEqual({
      status: "clear",
      signals: [],
      generationAllowed: true,
    });
  });

  it("clears a prior warning only after an explicit eligible manual review", () => {
    const eligible = {
      allowed: true,
      classification: "eligible" as const,
      reasonCodes: [],
      message: "Revisión completa.",
    };

    expect(
      resolveSafetySignalsAfterManualReview(
        ["recent_injury"],
        eligible,
        false,
      ),
    ).toEqual(["recent_injury"]);
    expect(
      resolveSafetySignalsAfterManualReview(
        ["recent_injury"],
        eligible,
        true,
      ),
    ).toEqual([]);
    expect(
      resolveSafetySignalsAfterManualReview(
        ["recent_injury"],
        { ...eligible, allowed: false, classification: "professional_guidance_required" },
        true,
      ),
    ).toEqual(["recent_injury"]);
  });
});
