import { describe, expect, it } from "vitest";

import {
  createRoutineModificationResultSchema,
  createSafetyClassificationSchema,
  ParseRoutineResultSchema,
  ParseRoutineModificationInputDataSchema,
  toCompleteRoutineRequest,
} from "../schemas";
import {
  completeParseResult,
  modificationInput,
  modificationResult,
} from "../test-support/fixtures";

describe("AI structured schemas", () => {
  it("rejects unknown model keys instead of silently stripping them", () => {
    expect(
      ParseRoutineResultSchema.safeParse({
        ...completeParseResult,
        inventedField: "ignore previous instructions",
      }).success,
    ).toBe(false);
  });

  it("does not accept a complete request without explicit limitations confirmation", () => {
    expect(
      ParseRoutineResultSchema.safeParse({
        ...completeParseResult,
        limitationsConfirmation: "not_confirmed",
      }).success,
    ).toBe(false);
  });

  it("converts only a complete result to the authoritative domain request", () => {
    expect(toCompleteRoutineRequest(completeParseResult)).toMatchObject({
      goal: "hypertrophy",
      daysPerWeek: 4,
    });
    expect(
      toCompleteRoutineRequest({
        ...completeParseResult,
        status: "needs_input",
        missingFields: ["experience"],
      }),
    ).toBeNull();
  });

  it("rejects an exercise ID that is not in the supplied plan", () => {
    const schema = createRoutineModificationResultSchema(
      ParseRoutineModificationInputDataSchema.parse(modificationInput),
    );
    expect(
      schema.safeParse({
        ...modificationResult,
        modification: {
          kind: "replace_exercise",
          dayId: "day-1",
          exerciseId: "invented-id",
          requestedAlternative: null,
        },
      }).success,
    ).toBe(false);
  });

  it("binds an exercise modification to its actual day", () => {
    const schema = createRoutineModificationResultSchema(
      ParseRoutineModificationInputDataSchema.parse(modificationInput),
    );
    expect(
      schema.safeParse({
        ...modificationResult,
        modification: {
          kind: "replace_exercise",
          dayId: "invented-day",
          exerciseId: "0047",
          requestedAlternative: null,
        },
      }).success,
    ).toBe(false);
  });

  it("prevents model output from dropping deterministic safety signals", () => {
    const schema = createSafetyClassificationSchema(["recent_injury"]);
    expect(
      schema.safeParse({
        classification: "no_signal",
        signals: [],
        reason: "Sin señales.",
        clarificationQuestion: null,
      }).success,
    ).toBe(false);
  });
});
