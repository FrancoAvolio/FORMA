import { describe, expect, it } from "vitest";

import {
  editRoutineExercisePrescription,
  reorderRoutineExercise,
} from "../../../application/routines/edit-routine";
import { regenerateRoutineDay } from "../../../application/routines/regenerate-day";
import {
  findRoutineExerciseSubstitutions,
  replaceRoutineExercise,
} from "../../../application/routines/replace-exercise";
import { generateRoutine } from "../engine/generate-routine";
import { CLEAR_SAFETY_SCREENING, createCatalog, createRoutineRequest } from "./fixtures";

const catalog = createCatalog();
const request = createRoutineRequest({ daysPerWeek: 4 });

function generatedPlan() {
  const result = generateRoutine({
    request,
    safetyScreening: CLEAR_SAFETY_SCREENING,
    catalog,
    datasetVersion: "fixture-v1",
    seed: "edit-fixture",
  });
  if (!result.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result.plan;
}

describe("routine application use cases", () => {
  it("replaces one exercise without regenerating unaffected days", () => {
    const plan = generatedPlan();
    const targetDay = plan.days[1]!;
    const target = targetDay.exercises[0]!;
    const alternatives = findRoutineExerciseSubstitutions({
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: targetDay.id,
      exerciseId: target.exerciseId,
      seed: "replacement",
    });
    expect(alternatives.length).toBeGreaterThan(0);

    const result = replaceRoutineExercise({
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: targetDay.id,
      exerciseId: target.exerciseId,
      replacementExerciseId: alternatives[0]!.id,
      seed: "replacement",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    plan.days.forEach((day, index) => {
      if (index !== 1) {
        expect(result.plan.days[index]).toBe(day);
      }
    });
    expect(result.plan.days[1]).not.toBe(plan.days[1]);
    expect(result.plan.days[1]!.exercises[0]!.exerciseId).toBe(alternatives[0]!.id);
  });

  it("reorders only the selected day", () => {
    const plan = generatedPlan();
    const targetDay = plan.days[0]!;
    const result = reorderRoutineExercise({
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: targetDay.id,
      fromIndex: 0,
      toIndex: 2,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.days[1]).toBe(plan.days[1]);
    expect(result.plan.days[0]!.exercises[2]).toBe(plan.days[0]!.exercises[0]);
  });

  it("edits RIR while retaining authoritative validation", () => {
    const plan = generatedPlan();
    const targetDay = plan.days[0]!;
    const target = targetDay.exercises[0]!;
    const result = editRoutineExercisePrescription({
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: targetDay.id,
      exerciseId: target.exerciseId,
      patch: { rir: 3 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.days[0]!.exercises[0]!.rir).toBe(3);
    expect(result.plan.days[1]).toBe(plan.days[1]);
  });

  it("regenerates one day and preserves all unaffected day references", () => {
    const plan = generatedPlan();
    const targetIndex = 2;
    const result = regenerateRoutineDay({
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: plan.days[targetIndex]!.id,
      seed: "second-version",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const previousIds = new Set(
      plan.days[targetIndex]!.exercises.map((exercise) => exercise.exerciseId),
    );
    expect(
      result.plan.days[targetIndex]!.exercises.every(
        (exercise) => !previousIds.has(exercise.exerciseId),
      ),
    ).toBe(true);
    plan.days.forEach((day, index) => {
      if (index !== targetIndex) {
        expect(result.plan.days[index]).toBe(day);
      }
    });
    expect(result.plan.days[targetIndex]).not.toBe(plan.days[targetIndex]);
  });
});
