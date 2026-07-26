import { describe, expect, it } from "vitest";

import { regenerateRoutineDay } from "../../../application/routines/regenerate-day";
import {
  findRoutineExerciseSubstitutions,
  replaceRoutineExercise,
} from "../../../application/routines/replace-exercise";
import { getRoutineCatalog } from "../../../data/routine-catalog";
import {
  ExperienceLevelSchema,
  RoutineGoalSchema,
} from "../../profile/routine-request";
import { COMMERCIAL_GYM_DEFAULT_EQUIPMENT } from "../engine/build-candidate-pool";
import { generateRoutine } from "../engine/generate-routine";
import { CLEAR_SAFETY_SCREENING, createRoutineRequest } from "./fixtures";

describe("routine engine with the generated curated catalog", () => {
  const catalog = getRoutineCatalog();

  it.each([1, 2, 3, 4, 5, 6])(
    "builds a validated %i-day commercial-gym routine",
    (daysPerWeek) => {
      const result = generateRoutine({
        request: createRoutineRequest({
          daysPerWeek,
          experience: daysPerWeek === 1 ? "beginner" : "intermediate",
          trainingLocation: "commercial_gym",
          availableEquipment: [
            "body_weight",
            "dumbbell",
            "barbell",
            "cable",
            "machine",
            "smith_machine",
            "bench",
          ],
        }),
        safetyScreening: CLEAR_SAFETY_SCREENING,
        catalog,
        datasetVersion: "7455efae",
        seed: `real-catalog-${daysPerWeek}`,
      });

      expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
      if (result.ok) {
        expect(result.validation.valid).toBe(true);
      }
    },
  );

  it("builds every goal, level, day, and guided-duration combination", () => {
    const failures: string[] = [];
    const durations = [30, 45, 60, 75, 90, 120] as const;

    for (const goal of RoutineGoalSchema.options) {
      for (const experience of ExperienceLevelSchema.options) {
        for (let daysPerWeek = 1; daysPerWeek <= 6; daysPerWeek += 1) {
          for (const sessionMinutes of durations) {
            const key = `${goal}/${experience}/${daysPerWeek}d/${sessionMinutes}m`;
            const result = generateRoutine({
              request: createRoutineRequest({
                goal,
                experience,
                daysPerWeek,
                sessionMinutes,
                trainingLocation: "commercial_gym",
                availableEquipment: [...COMMERCIAL_GYM_DEFAULT_EQUIPMENT],
              }),
              safetyScreening: CLEAR_SAFETY_SCREENING,
              catalog,
              datasetVersion: "7455efae",
              seed: `guided-matrix-${key}`,
            });
            if (!result.ok) {
              failures.push(`${key}: ${result.code} ${result.message}`);
            }
          }
        }
      }
    }

    expect(failures, failures.join("\n")).toEqual([]);
  }, 60_000);

  it("supports a dumbbell/bodyweight request with a back priority", () => {
    const result = generateRoutine({
      request: createRoutineRequest({
        daysPerWeek: 3,
        sessionMinutes: 45,
        trainingLocation: "home",
        availableEquipment: ["dumbbell", "body_weight"],
        focusMuscles: ["back"],
      }),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "7455efae",
      seed: "dumbbell-home",
    });
    expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
  });

  it("supports a two-day bodyweight-only beginner routine", () => {
    const result = generateRoutine({
      request: createRoutineRequest({
        goal: "general_fitness",
        experience: "beginner",
        daysPerWeek: 2,
        sessionMinutes: 40,
        trainingLocation: "home",
        availableEquipment: ["body_weight"],
      }),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "7455efae",
      seed: "bodyweight-home",
    });
    expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
    if (result.ok) {
      const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
      expect(result.validation.valid).toBe(true);
      expect(
        result.plan.days
          .flatMap((day) => day.exercises)
          .every((prescribed) =>
            byId
              .get(prescribed.exerciseId)
              ?.equipment.every((equipment) =>
                ["body_weight", "none"].includes(equipment),
              ),
          ),
      ).toBe(true);
    }
  });

  it("never selects an explicitly excluded movement pattern", () => {
    const result = generateRoutine({
      request: createRoutineRequest({
        daysPerWeek: 4,
        trainingLocation: "commercial_gym",
        availableEquipment: [],
        excludedMovementPatterns: ["hinge"],
      }),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "7455efae",
      seed: "without-hinges",
    });
    expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
    if (result.ok) {
      const byId = new Map(catalog.map((exercise) => [exercise.id, exercise]));
      expect(
        result.plan.days
          .flatMap((day) => day.exercises)
          .every((exercise) => byId.get(exercise.exerciseId)?.movementPattern !== "hinge"),
      ).toBe(true);
    }
  });

  it("substitutes an exercise and regenerates one day against the real catalog", () => {
    const request = createRoutineRequest({
      daysPerWeek: 4,
      trainingLocation: "commercial_gym",
      availableEquipment: [],
    });
    const generated = generateRoutine({
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "7455efae",
      seed: "real-catalog-mutations",
    });
    expect(generated.ok, !generated.ok ? JSON.stringify(generated) : undefined).toBe(
      true,
    );
    if (!generated.ok) return;

    const originalPlan = generated.plan;
    let replacementResult: ReturnType<typeof replaceRoutineExercise> | undefined;
    let replacedDayIndex = -1;
    for (let dayIndex = 0; dayIndex < originalPlan.days.length; dayIndex += 1) {
      const day = originalPlan.days[dayIndex]!;
      for (const prescribed of day.exercises) {
        const alternatives = findRoutineExerciseSubstitutions({
          plan: originalPlan,
          request,
          safetyScreening: CLEAR_SAFETY_SCREENING,
          catalog,
          dayId: day.id,
          exerciseId: prescribed.exerciseId,
          seed: "real-catalog-replacement",
        });
        for (const alternative of alternatives) {
          const candidate = replaceRoutineExercise({
            plan: originalPlan,
            request,
            safetyScreening: CLEAR_SAFETY_SCREENING,
            catalog,
            dayId: day.id,
            exerciseId: prescribed.exerciseId,
            replacementExerciseId: alternative.id,
            seed: "real-catalog-replacement",
          });
          if (candidate.ok) {
            replacementResult = candidate;
            replacedDayIndex = dayIndex;
            break;
          }
        }
        if (replacementResult?.ok) break;
      }
      if (replacementResult?.ok) break;
    }

    expect(replacementResult?.ok).toBe(true);
    if (!replacementResult?.ok) return;
    originalPlan.days.forEach((day, index) => {
      if (index !== replacedDayIndex) {
        expect(replacementResult.plan.days[index]).toBe(day);
      }
    });

    const regenerateIndex = replacedDayIndex === 1 ? 2 : 1;
    const regenerated = regenerateRoutineDay({
      plan: replacementResult.plan,
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      dayId: replacementResult.plan.days[regenerateIndex]!.id,
      seed: "real-catalog-regeneration",
    });
    expect(regenerated.ok, !regenerated.ok ? JSON.stringify(regenerated) : undefined).toBe(
      true,
    );
    if (regenerated.ok) {
      replacementResult.plan.days.forEach((day, index) => {
        if (index !== regenerateIndex) {
          expect(regenerated.plan.days[index]).toBe(day);
        }
      });
    }
  });
});
