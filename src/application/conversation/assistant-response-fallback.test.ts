import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
import type { ValidatedAssistantResponseContext } from "../../ai/schemas/assistant-response";
import { composeAssistantFallback } from "./assistant-response-fallback";

const baseContext: ValidatedAssistantResponseContext = {
  latestIntent: "greeting",
  canonicalDraft: createEmptyRoutineRequestDraft(),
  limitationsConfirmation: "not_confirmed",
  missingFields: [
    "goal",
    "experience",
    "daysPerWeek",
    "sessionMinutes",
    "trainingLocationOrEquipment",
    "limitationsConfirmation",
  ],
  completionPercentage: 0,
  parseStatus: "needs_input",
  safetyResult: {
    status: "needs_review",
    signals: [],
    generationAllowed: false,
  },
  focusedQuestionFields: ["limitationsConfirmation", "goal"],
  validatedPlan: null,
  exerciseContext: null,
  allowedNextActions: [
    "ask_missing_information",
    "open_guided_form",
  ],
  assumptions: [],
  locale: "es-AR",
};

describe("deterministic assistant fallback", () => {
  it("greets naturally and asks only the focused questions", () => {
    const message = composeAssistantFallback(baseContext);
    expect(message).toContain("Hola");
    expect(message).toContain("restricción");
    expect(message).toContain("objetivo principal");
    expect(message).not.toContain("equipamiento");
  });

  it("uses only grounded exercise facts for an exercise question", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "ask_question",
      exerciseContext: {
        exerciseId: "0047",
        displayName: "Press inclinado con mancuernas",
        primaryTarget: "pecho",
        secondaryMuscles: ["tríceps"],
        equipment: ["mancuernas"],
        instructions: ["Apoyá la espalda y controlá el descenso."],
        selectionReasons: ["Es compatible con tu equipamiento"],
        approvedAlternatives: [],
      },
      allowedNextActions: ["answer_question"],
    });
    expect(message).toContain("Press inclinado con mancuernas");
    expect(message).toContain("pecho");
    expect(message).toContain("compatible con tu equipamiento");
  });

  it("blocks generation calmly when deterministic safety does not allow it", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "unsupported",
      parseStatus: "unsupported",
      safetyResult: {
        status: "unsupported",
        signals: ["recent_injury"],
        generationAllowed: false,
      },
      allowedNextActions: ["browse_exercises", "open_guided_form"],
    });
    expect(message).toContain("no voy a generar una rutina");
    expect(message).toContain("catálogo");
    expect(message).not.toMatch(/diagnóstico|rehabilitación/i);
  });
});
