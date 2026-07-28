import { describe, expect, it } from "vitest";

import {
  createRoutineModificationResultSchema,
  createSafetyClassificationSchema,
  ParsedRoutineTurnSchema,
  ParseRoutineModificationInputDataSchema,
} from "../schemas";
import {
  completeParsedTurn,
  modificationInput,
  modificationResult,
} from "../test-support/fixtures";

describe("AI structured schemas", () => {
  it("rejects unknown model keys instead of silently stripping them", () => {
    expect(
      ParsedRoutineTurnSchema.safeParse({
        ...completeParsedTurn,
        inventedField: "ignore previous instructions",
      }).success,
    ).toBe(false);
  });

  it("accepts empty patches for greetings and questions", () => {
    expect(
      ParsedRoutineTurnSchema.safeParse({
        intent: "greeting",
        requestPatch: {},
        limitationsConfirmation: "unknown",
        safetySignals: [],
        assumptions: [],
      }).success,
    ).toBe(true);
  });

  it("rejects derived model state and malformed patches", () => {
    expect(
      ParsedRoutineTurnSchema.safeParse({
        ...completeParsedTurn,
        status: "complete",
        missingFields: [],
      }).success,
    ).toBe(false);
    expect(
      ParsedRoutineTurnSchema.safeParse({
        ...completeParsedTurn,
        requestPatch: { daysPerWeek: 12 },
      }).success,
    ).toBe(false);
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

  it("binds a day-shortening command to a real day", () => {
    const schema = createRoutineModificationResultSchema(
      ParseRoutineModificationInputDataSchema.parse(modificationInput),
    );
    const command = (dayId: string) => ({
      ...modificationResult,
      modification: {
        kind: "shorten_day" as const,
        dayId,
        targetMinutes: null,
      },
    });

    expect(schema.safeParse(command("day-1")).success).toBe(true);
    expect(schema.safeParse(command("invented-day")).success).toBe(false);
  });

  it("accepts a muscle-scoped removal without allowing model-selected IDs", () => {
    const schema = createRoutineModificationResultSchema(
      ParseRoutineModificationInputDataSchema.parse(modificationInput),
    );
    expect(
      schema.safeParse({
        ...modificationResult,
        modification: { kind: "remove_one_by_muscle", muscle: "biceps" },
      }).success,
    ).toBe(true);
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
