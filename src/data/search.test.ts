import { describe, expect, it } from "vitest";

import { expandExerciseQuery, searchExerciseResults, searchExercises } from "./search";

describe("exercise search", () => {
  it("expands accent-insensitive Spanish aliases", () => {
    expect(expandExerciseQuery("Máquina para pecho")).toContain("machine");
    expect(expandExerciseQuery("Máquina para pecho")).toContain("pectorals");
  });

  it("retrieves only real local records for a Spanish query", () => {
    const results = searchExercises("pecho con mancuernas", { equipment: "dumbbell" }, 20);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((exercise) => exercise.equipment === "dumbbell")).toBe(true);
    expect(results.every((exercise) => /^\d{4}$/u.test(exercise.id))).toBe(true);
  });

  it("combines approved and structured filters", () => {
    const results = searchExercises("", {
      approvedOnly: true,
      movementPattern: "horizontal_push",
      equipment: "mancuernas",
      primaryMuscle: "pecho",
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((exercise) => exercise.approvedForGeneration)).toBe(true);
    expect(results.every((exercise) => exercise.movementPattern === "horizontal_push")).toBe(true);
  });

  it("exposes the full filtered set for exact application pagination", () => {
    expect(searchExerciseResults("", {})).toHaveLength(1324);
    expect(searchExercises("", {}, 10)).toHaveLength(10);
  });

  it("resolves Spanish aliases for inferred secondary equipment", () => {
    const results = searchExerciseResults("", { equipment: "banco" });
    expect(results.some((exercise) => exercise.id === "0025")).toBe(true);
    expect(results.every((exercise) => exercise.requiredEquipment.includes("bench"))).toBe(true);
  });

  it("resolves only an exact trimmed four-digit exercise id", () => {
    expect(searchExerciseResults(" 0001 ").map((exercise) => exercise.id)).toEqual(["0001"]);
    expect(searchExerciseResults("exercise 0001").some((exercise) => exercise.id === "0001")).toBe(
      false,
    );
    expect(searchExerciseResults("000").some((exercise) => exercise.id === "0001")).toBe(false);
  });

  it("applies structured filters after an exact id lookup", () => {
    expect(searchExerciseResults("0001", { bodyPart: "not_a_body_part" })).toEqual([]);
  });
});
