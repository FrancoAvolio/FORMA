import { describe, expect, it } from "vitest";

import { getExerciseSummaryById } from "./catalog";
import { getExerciseDetailById } from "./details";
import { getRoutineCatalog } from "./routine-catalog";
import { ExerciseDetailSchema, ExerciseSummarySchema } from "./schemas";

describe("generated runtime catalogs", () => {
  it("exposes only validated approved records to the routine engine", () => {
    const catalog = getRoutineCatalog();
    expect(catalog).toHaveLength(156);
    expect(new Set(catalog.map((exercise) => exercise.id)).size).toBe(catalog.length);
    expect(catalog.every((exercise) => exercise.approvedForGeneration)).toBe(true);
  });

  it("links every generation record to Spanish instructions and attribution", () => {
    for (const exercise of getRoutineCatalog()) {
      const detail = getExerciseDetailById(exercise.id);
      expect(detail?.instructionStepsEs.length).toBeGreaterThan(0);
      expect(detail?.sourceMedia?.attribution).toContain("Gym visual");
      expect(detail?.sourceAttribution).toContain(
        "7455efae41b330c265e7cd4b78dfa848e7ce5ebd",
      );
    }
  });

  it("carries explicit secondary equipment into the engine boundary", () => {
    expect(getExerciseSummaryById("0025")?.requiredEquipment).toEqual([
      "barbell",
      "barbell_rack",
      "bench",
    ]);
    expect(getExerciseSummaryById("0652")?.requiredEquipment).toEqual([
      "body_weight",
      "pull_up_bar",
    ]);
    expect(getExerciseSummaryById("0662")?.requiredEquipment).toEqual([
      "body_weight",
    ]);
  });

  it("rejects malformed compact and detail artifacts at their runtime boundaries", () => {
    const summary = getExerciseSummaryById("0001");
    const detail = getExerciseDetailById("0001");
    expect(summary).not.toBeNull();
    expect(detail).not.toBeNull();
    if (!summary || !detail) throw new Error("Pinned fixture 0001 is missing.");
    expect(
      ExerciseSummarySchema.safeParse({ ...summary, requiredEquipment: [] }).success,
    ).toBe(false);
    expect(
      ExerciseDetailSchema.safeParse({ ...detail, instructionStepsEs: [] }).success,
    ).toBe(false);
  });
});
