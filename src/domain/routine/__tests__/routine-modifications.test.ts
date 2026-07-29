import { describe, expect, it } from "vitest";

import {
  editRoutineExercisePrescription,
  reorderRoutineExercise,
} from "../../../application/routines/edit-routine";
import { applyConversationRoutineModification } from "../../../application/routines/apply-conversation-modification";
import { regenerateRoutineDay } from "../../../application/routines/regenerate-day";
import {
  findRoutineExerciseSubstitutions,
  replaceRoutineExercise,
} from "../../../application/routines/replace-exercise";
import { generateRoutine } from "../engine/generate-routine";
import { sessionTimeBounds } from "../config/session-time";
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

  it("applies a conversational replacement through the same validated use case", () => {
    const plan = generatedPlan();
    const targetDay = plan.days[1]!;
    const target = targetDay.exercises[0]!;
    const result = applyConversationRoutineModification({
      modification: {
        kind: "replace_exercise",
        dayId: targetDay.id,
        exerciseId: target.exerciseId,
        requestedAlternative: "otro ejercicio compatible",
      },
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "conversation-replacement",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changedScope).toBe("exercise");
    plan.days.forEach((day, index) => {
      if (index !== 1) expect(result.plan.days[index]).toBe(day);
    });
    expect(result.plan.days[1]!.exercises[0]!.exerciseId).not.toBe(
      target.exerciseId,
    );
  });

  it("shortens only the requested day and validates the complete plan", () => {
    const plan = generatedPlan();
    const targetIndex = 1;
    const targetDay = plan.days[targetIndex]!;
    const result = applyConversationRoutineModification({
      modification: {
        kind: "shorten_day",
        dayId: targetDay.id,
        targetMinutes: null,
      },
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "conversation-shorten-day",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changedScope).toBe("day");
    expect(result.plan.days[targetIndex]!.estimatedMinutes).toBeLessThan(
      targetDay.estimatedMinutes,
    );
    plan.days.forEach((day, index) => {
      if (index !== targetIndex) expect(result.plan.days[index]).toBe(day);
    });
  });

  it("removes one deterministic exercise for a requested muscle", () => {
    const plan = generatedPlan();
    const matching = plan.days.flatMap((day) =>
      day.exercises.filter((prescribed) => {
        const exercise = catalog.find((candidate) => candidate.id === prescribed.exerciseId);
        return exercise?.primaryMuscles.includes("biceps") || exercise?.secondaryMuscles.includes("biceps");
      }),
    );
    expect(matching.length).toBeGreaterThan(0);
    const result = applyConversationRoutineModification({
      modification: { kind: "remove_one_by_muscle", muscle: "bíceps" },
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "conversation-remove-muscle",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const remaining = result.plan.days.flatMap((day) => day.exercises);
    expect(remaining).toHaveLength(
      plan.days.flatMap((day) => day.exercises).length - 1,
    );
    expect(result.changedScope).toBe("exercise");
  });

  it("removes explicitly rejected equipment instead of treating it as available", () => {
    const equipmentRequest = createRoutineRequest({
      trainingLocation: "custom",
      availableEquipment: ["body_weight", "barbell"],
    });
    const generated = generateRoutine({
      request: equipmentRequest,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "equipment-exclusion",
    });
    if (!generated.ok) throw new Error(JSON.stringify(generated));

    const result = applyConversationRoutineModification({
      modification: { kind: "exclude_equipment", equipment: ["barbell"] },
      plan: generated.plan,
      request: equipmentRequest,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "equipment-exclusion-change",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request.availableEquipment).toEqual(["body_weight"]);
    expect(result.plan).toBe(generated.plan);
  });

  it("honors a requested machine constraint when replacing an exercise", () => {
    const plan = generatedPlan();
    const usedIds = new Set(
      plan.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.exerciseId),
      ),
    );
    let target:
      | { dayId: string; exerciseId: string; alternativeId: string }
      | undefined;
    for (const day of plan.days) {
      for (const prescribed of day.exercises) {
        const original = catalog.find(
          (exercise) => exercise.id === prescribed.exerciseId,
        );
        const alternative = original
          ? catalog.find(
              (exercise) =>
                exercise.id !== original.id &&
                !usedIds.has(exercise.id) &&
                exercise.substitutionGroup === original.substitutionGroup,
            )
          : undefined;
        if (alternative) {
          target = {
            dayId: day.id,
            exerciseId: prescribed.exerciseId,
            alternativeId: alternative.id,
          };
          break;
        }
      }
      if (target) break;
    }
    expect(target).toBeDefined();
    if (!target) return;

    const mixedCatalog = catalog.map((exercise) =>
      exercise.id === target?.alternativeId
        ? { ...exercise, equipment: ["machine"] }
        : exercise,
    );
    const result = applyConversationRoutineModification({
      modification: {
        kind: "replace_exercise",
        dayId: target.dayId,
        exerciseId: target.exerciseId,
        requestedAlternative: "uno con máquina",
      },
      plan,
      request: {
        ...request,
        availableEquipment: ["body_weight", "machine"],
      },
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog: mixedCatalog,
      datasetVersion: "fixture-v1",
      seed: "machine-constrained-replacement",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const replacementId = result.plan.days
      .find((day) => day.id === target?.dayId)
      ?.exercises.find((exercise) => exercise.exerciseId === target?.alternativeId)
      ?.exerciseId;
    expect(replacementId).toBe(target.alternativeId);
  });

  it("keeps a valid plan stable when a conversational profile patch needs no rebuild", () => {
    const plan = generatedPlan();
    const result = applyConversationRoutineModification({
      modification: { kind: "update_request", patch: { notes: "Prefiero entrenar temprano" } },
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "conversation-profile",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changedScope).toBe("profile");
    expect(result.plan).toBe(plan);
    expect(result.request.notes).toBe("Prefiero entrenar temprano");
  });

  it("rebuilds a 60-minute routine when the conversation changes it to 90 minutes", () => {
    const plan = generatedPlan();
    const result = applyConversationRoutineModification({
      modification: { kind: "update_request", patch: { sessionMinutes: 90 } },
      plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "conversation-duration-90",
    });

    expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
    if (!result.ok) return;
    expect(result.changedScope).toBe("routine");
    expect(result.plan).not.toBe(plan);
    const bounds = sessionTimeBounds(90);
    for (const day of result.plan.days) {
      expect(day.estimatedMinutes).toBeGreaterThanOrEqual(bounds.lower);
      expect(day.estimatedMinutes).toBeLessThanOrEqual(bounds.upper);
    }
  });
});
