import { describe, expect, it } from "vitest";

import { RoutineRequestSchema } from "../../profile/routine-request";
import {
  detectLimitationsDeclaration,
  detectSafetyReasonCodes,
} from "../../safety/detect-safety-text";
import { evaluateRoutineSafety } from "../../safety/evaluate-safety";
import { CLEAR_SAFETY_SCREENING, createRoutineRequest } from "./fixtures";

describe("RoutineRequestSchema", () => {
  it("accepts a location without an explicit equipment list", () => {
    const result = RoutineRequestSchema.safeParse(
      createRoutineRequest({ availableEquipment: [] }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects unsupported day and duration bounds", () => {
    expect(
      RoutineRequestSchema.safeParse(
        createRoutineRequest({ daysPerWeek: 7, sessionMinutes: 10 }),
      ).success,
    ).toBe(false);
  });
});

describe("evaluateRoutineSafety", () => {
  it("requires an explicit current-status confirmation", () => {
    const assessment = evaluateRoutineSafety(createRoutineRequest(), {
      ...CLEAR_SAFETY_SCREENING,
      confirmedCurrentStatus: false,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.classification).toBe("confirmation_required");
  });

  it("blocks affirmative state-based safety answers without diagnosing", () => {
    const assessment = evaluateRoutineSafety(createRoutineRequest(), {
      ...CLEAR_SAFETY_SCREENING,
      recentInjury: true,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCodes).toContain("RECENT_INJURY");
    expect(assessment.message).not.toMatch(/diagn[oó]stico de/i);
  });

  it.each([
    ["Me lesioné ayer, armame una rutina", "ACUTE_INJURY_REQUEST"],
    ["Necesito rehabilitación de rodilla", "REHABILITATION_REQUEST"],
    ["Quiero una rutina durante el embarazo", "PREGNANCY_SPECIFIC_REQUEST"],
    ["Tengo 15 años", "MINOR_REQUEST"],
    ["Recomendame una dosis de medicación", "MEDICATION_REQUEST"],
    ["Tengo un trastorno alimentario", "EATING_DISORDER_REQUEST"],
  ] as const)("blocks deterministic keyword case: %s", (notes, expectedCode) => {
    const assessment = evaluateRoutineSafety(
      createRoutineRequest({ notes }),
      CLEAR_SAFETY_SCREENING,
    );
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCodes).toContain(expectedCode);
  });

  it("does not block a neutral movement preference", () => {
    const assessment = evaluateRoutineSafety(
      createRoutineRequest({ limitations: ["Prefiero evitar saltos"] }),
      CLEAR_SAFETY_SCREENING,
    );
    expect(assessment.allowed).toBe(true);
  });

  it("fails closed when limitation text contradicts an all-clear questionnaire", () => {
    const assessment = evaluateRoutineSafety(
      createRoutineRequest({
        limitations: ["Me duele la rodilla cuando hago sentadillas"],
      }),
      CLEAR_SAFETY_SCREENING,
    );

    expect(assessment.allowed).toBe(false);
    expect(assessment.classification).toBe("professional_guidance_required");
    expect(assessment.reasonCodes).toContain("PAIN_DURING_MOVEMENT");
  });

  it("detects raw safety language without treating an explicit all-clear as a signal", () => {
    expect(detectSafetyReasonCodes("Me lesioné ayer y me duele al mover el hombro"))
      .toEqual(expect.arrayContaining(["ACUTE_INJURY_REQUEST", "PAIN_DURING_MOVEMENT"]));
    expect(
      detectSafetyReasonCodes("No tengo dolor, lesiones ni restricciones"),
    ).toEqual([]);
  });

  it("derives limitations confirmation only from explicit deterministic language", () => {
    expect(
      detectLimitationsDeclaration(
        "Una hora por sesión y no tengo ninguna lesión ni restricción",
      ),
    ).toBe("no_limitations");
    expect(detectLimitationsDeclaration("Hola bro")).toBe("unknown");
    expect(detectLimitationsDeclaration("Me duele la rodilla al entrenar")).toBe(
      "has_limitations",
    );
  });

  it("allows clear professional movement restrictions without interpreting medical advice", () => {
    const assessment = evaluateRoutineSafety(
      createRoutineRequest({ excludedMovementPatterns: ["hinge"] }),
      {
        ...CLEAR_SAFETY_SCREENING,
        professionalInstructionsAffectTraining: true,
      },
    );
    expect(assessment.allowed).toBe(true);
    expect(assessment.message).toMatch(/movimientos o ejercicios concretos/i);
  });

  it("blocks unspecified professional instructions", () => {
    const assessment = evaluateRoutineSafety(createRoutineRequest(), {
      ...CLEAR_SAFETY_SCREENING,
      professionalInstructionsAffectTraining: true,
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCodes).toContain("PROFESSIONAL_INSTRUCTIONS");
  });
});
