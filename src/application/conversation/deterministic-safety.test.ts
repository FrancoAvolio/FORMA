import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
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
        limitationsConfirmation: "no_limitations",
        safetySignals: ["recent_injury", "pain_during_movement"],
      },
      "No tengo dolor, lesiones, s\u00edntomas ni restricciones",
    );

    expect(result.intent).toBe("provide_information");
    expect(result.safetySignals).toEqual([]);
    expect(result.limitationsConfirmation).toBe("no_limitations");
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
