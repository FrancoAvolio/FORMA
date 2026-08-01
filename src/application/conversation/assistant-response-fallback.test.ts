import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
import type { ValidatedAssistantResponseContext } from "../../ai/schemas/assistant-response";
import {
  composeAssistantFallback,
  composeUnsupportedSessionDurationReply,
} from "./assistant-response-fallback";

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
  safetyMissingFields: [],
  safetyAnsweredFields: [],
  safetyAnsweredCount: 0,
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
  it("explains the supported duration range instead of repeating the question", () => {
    const message = composeUnsupportedSessionDurationReply(150);

    expect(message).toContain("20 a 120 minutos");
    expect(message).toContain("Pediste 150 minutos");
    expect(message).toContain("Elegí un valor dentro del rango");
  });

  it("greets naturally and asks only the focused questions", () => {
    const message = composeAssistantFallback(baseContext);
    expect(message).toContain("Hola");
    expect(message).toContain("restricción");
    expect(message).toContain("objetivo principal");
    expect(message).not.toContain("equipamiento");
  });

  it("acknowledges the canonical profile without inventing equipment or priorities", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "provide_information",
      canonicalDraft: {
        ...createEmptyRoutineRequestDraft(),
        goal: "hypertrophy",
        experience: "intermediate",
        daysPerWeek: 4,
        sessionMinutes: 60,
        trainingLocation: "commercial_gym",
        focusMuscles: ["back", "biceps"],
      },
      missingFields: ["limitationsConfirmation"],
      completionPercentage: 83,
      focusedQuestionFields: ["limitationsConfirmation"],
    });

    expect(message).toContain("hipertrofia");
    expect(message).toContain("nivel intermedio");
    expect(message).toContain("4 días por semana");
    expect(message).toContain("60 minutos");
    expect(message).toContain("gimnasio comercial");
    expect(message).toContain("espalda y bíceps");
    expect(message).not.toContain("glúteos");
    expect(message).not.toContain("sin equipo");
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

  it("redirects off-topic messages without repeating the safety review", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "off_topic",
    });

    expect(message).toMatch(/rutinas|ejercicios|equipamiento/i);
    expect(message).not.toMatch(/dolor|lesiones|restricciones/i);
  });

  it("acknowledges a partial safety answer and asks only unresolved categories", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "provide_information",
      missingFields: ["limitationsConfirmation"],
      completionPercentage: 83,
      focusedQuestionFields: ["limitationsConfirmation"],
      safetyMissingFields: [
        "painDuringMovement",
        "recentInjury",
        "recentOperation",
        "symptomsDuringExercise",
        "professionalInstructionsAffectTraining",
      ],
      safetyAnsweredFields: ["medicalRestriction"],
      safetyAnsweredCount: 1,
    });

    expect(message).toContain("restricciones médicas");
    expect(message).toContain("dolor al moverte");
    expect(message).not.toContain("restricción para entrenar");
  });

  it("asks for missing profile data after safety is fully confirmed", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "provide_information",
      canonicalDraft: {
        ...createEmptyRoutineRequestDraft(),
        goal: "hypertrophy",
        daysPerWeek: 4,
        sessionMinutes: 60,
        trainingLocation: "commercial_gym",
      },
      limitationsConfirmation: "confirmed_none",
      missingFields: ["experience"],
      completionPercentage: 83,
      parseStatus: "needs_input",
      focusedQuestionFields: ["experience"],
      safetyMissingFields: [],
      safetyAnsweredFields: [
        "painDuringMovement",
        "recentInjury",
        "recentOperation",
        "medicalRestriction",
        "symptomsDuringExercise",
        "professionalInstructionsAffectTraining",
      ],
      safetyAnsweredCount: 6,
      safetyResult: {
        status: "clear",
        signals: [],
        generationAllowed: true,
      },
    });

    expect(message).toContain("nivel actual");
    expect(message).not.toContain("dolor al moverte");
  });

  it("explains that a short contextual No is enough when no safety field is answered", () => {
    const message = composeAssistantFallback({
      ...baseContext,
      latestIntent: "provide_information",
      canonicalDraft: {
        ...createEmptyRoutineRequestDraft(),
        goal: "hypertrophy",
        daysPerWeek: 4,
        sessionMinutes: 60,
        trainingLocation: "commercial_gym",
      },
      missingFields: ["limitationsConfirmation"],
      completionPercentage: 83,
      focusedQuestionFields: ["limitationsConfirmation"],
      safetyMissingFields: [
        "painDuringMovement",
        "recentInjury",
        "recentOperation",
        "medicalRestriction",
        "symptomsDuringExercise",
        "professionalInstructionsAffectTraining",
      ],
      safetyAnsweredFields: [],
      safetyAnsweredCount: 0,
    });

    expect(message).toContain("alcanza con responder “No”");
    expect(message).not.toContain(
      "No tengo dolor al moverme, lesiones recientes",
    );
  });
});
