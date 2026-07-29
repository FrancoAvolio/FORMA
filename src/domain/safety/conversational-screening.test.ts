import { describe, expect, it } from "vitest";

import {
  createEmptyConversationalSafetyScreeningDraft,
  deriveConversationalSafetyStatus,
  deriveMissingSafetyFields,
  extractConversationalSafetyPatch,
  mergeConversationalSafetyPatch,
  toCompleteSafetyScreening,
} from "./conversational-screening";

describe("conversational safety screening", () => {
  it("keeps a broad restriction denial scoped to the restriction field", () => {
    const patch = extractConversationalSafetyPatch(
      "No tengo ninguna restricción para entrenar.",
    );

    expect(patch).toEqual({ medicalRestriction: false });
    expect(Object.keys(patch)).toHaveLength(1);
  });

  it("extracts only pain when the user denies pain", () => {
    expect(extractConversationalSafetyPatch("No tengo dolor.")).toEqual({
      painDuringMovement: false,
    });
  });

  it("extracts injury and operation denials from a coordinated clause", () => {
    expect(
      extractConversationalSafetyPatch(
        "No tuve lesiones ni operaciones recientes.",
      ),
    ).toEqual({ recentInjury: false, recentOperation: false });
  });

  it("handles mixed positive and negative clauses independently", () => {
    expect(
      extractConversationalSafetyPatch(
        "Tengo dolor al hacer sentadillas, pero no tuve ninguna operación.",
      ),
    ).toEqual({ painDuringMovement: true, recentOperation: false });
  });

  it("derives progress and eligibility without synthesizing unanswered fields", () => {
    const empty = createEmptyConversationalSafetyScreeningDraft();
    const partial = mergeConversationalSafetyPatch(empty, {
      painDuringMovement: false,
    });

    expect(deriveMissingSafetyFields(partial)).toHaveLength(5);
    expect(deriveConversationalSafetyStatus(partial)).toBe("pending");
    expect(toCompleteSafetyScreening(partial)).toBeNull();
  });

  it("completes only after all six explicit negative answers", () => {
    const complete = mergeConversationalSafetyPatch(
      createEmptyConversationalSafetyScreeningDraft(),
      {
        painDuringMovement: false,
        recentInjury: false,
        recentOperation: false,
        medicalRestriction: false,
        symptomsDuringExercise: false,
        professionalInstructionsAffectTraining: false,
      },
    );

    expect(deriveMissingSafetyFields(complete)).toEqual([]);
    expect(deriveConversationalSafetyStatus(complete)).toBe("eligible");
    expect(toCompleteSafetyScreening(complete)).toMatchObject({
      confirmedCurrentStatus: true,
      painDuringMovement: false,
      recentInjury: false,
      recentOperation: false,
    });
  });
});
