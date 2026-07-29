import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { calculateWeeklyVolume } from "../engine/calculate-weekly-volume";
import { estimateSessionDuration } from "../engine/estimate-session-duration";
import { generateRoutine } from "../engine/generate-routine";
import { createRoutineSeed } from "../engine/seed";
import { validateRoutine } from "../validators/validate-routine";
import { CLEAR_SAFETY_SCREENING, createCatalog, createRoutineRequest } from "./fixtures";

const catalog = createCatalog();

describe("generateRoutine", () => {
  it("is reproducible from the request, versions, seed, and explicit timestamp", () => {
    const input = {
      request: createRoutineRequest(),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      engineVersion: "test-engine",
      seed: createRoutineSeed("2026-01-01T00:00:00.000Z", "repeatable-seed"),
    };
    const first = generateRoutine(input);
    const second = generateRoutine(input);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.validation.valid).toBe(true);
      expect(first.plan.days).toHaveLength(input.request.daysPerWeek);
      expect(first.plan.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    }
  });

  it("blocks generation before touching selection when safety is not cleared", () => {
    const result = generateRoutine({
      request: createRoutineRequest(),
      safetyScreening: { ...CLEAR_SAFETY_SCREENING, recentOperation: true },
      catalog,
      datasetVersion: "fixture-v1",
      seed: "blocked",
    });
    expect(result).toMatchObject({ ok: false, code: "SAFETY_BLOCKED" });
  });

  it("calculates direct and indirect weekly volume", () => {
    const result = generateRoutine({
      request: createRoutineRequest({ daysPerWeek: 2 }),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "volume",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const volume = calculateWeeklyVolume(result.plan, catalog);
      expect(Object.keys(volume).length).toBeGreaterThan(4);
      expect(Object.values(volume).some((item) => item.indirectSets > 0)).toBe(true);
    }
  });

  it("reports an injected unknown exercise instead of silently accepting it", () => {
    const result = generateRoutine({
      request: createRoutineRequest({ daysPerWeek: 1 }),
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "unknown-validation",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const invalidPlan = {
      ...result.plan,
      days: [
        {
          ...result.plan.days[0]!,
          exercises: [
            { ...result.plan.days[0]!.exercises[0]!, exerciseId: "does-not-exist" },
            ...result.plan.days[0]!.exercises.slice(1),
          ],
        },
      ],
    };
    const validation = validateRoutine(
      invalidPlan,
      createRoutineRequest({ daysPerWeek: 1 }),
      catalog,
      CLEAR_SAFETY_SCREENING,
    );
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((issue) => issue.code === "UNKNOWN_EXERCISE")).toBe(true);
  });

  it("rejects a new plan whose visible blocks make it materially shorter than requested", () => {
    const request = createRoutineRequest({ daysPerWeek: 1, sessionMinutes: 60 });
    const result = generateRoutine({
      request,
      safetyScreening: CLEAR_SAFETY_SCREENING,
      catalog,
      datasetVersion: "fixture-v1",
      seed: "short-session-validation",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const originalDay = result.plan.days[0]!;
    const sessionBlocks = originalDay.sessionBlocks!.map((block) => ({
      ...block,
      estimatedMinutes: 1,
    }));
    const shortDay = {
      ...originalDay,
      sessionBlocks,
      estimatedMinutes: estimateSessionDuration(
        originalDay.exercises,
        catalog,
        sessionBlocks,
      ),
    };
    const validation = validateRoutine(
      { ...result.plan, days: [shortDay] },
      request,
      catalog,
      CLEAR_SAFETY_SCREENING,
    );

    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some((issue) => issue.code === "DURATION_OUT_OF_RANGE"),
    ).toBe(true);
  });

  it("satisfies generation invariants across supported request dimensions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }),
        fc.constantFrom(
          "hypertrophy" as const,
          "strength" as const,
          "general_fitness" as const,
          "muscular_endurance" as const,
        ),
        fc.constantFrom(
          "beginner" as const,
          "intermediate" as const,
          "advanced" as const,
        ),
        fc.integer({ min: 20, max: 100 }),
        fc.stringMatching(/^[a-z0-9]{1,16}$/),
        (daysPerWeek, goal, experience, sessionMinutes, seed) => {
          const request = createRoutineRequest({
            daysPerWeek,
            goal,
            experience,
            sessionMinutes,
          });
          const result = generateRoutine({
            request,
            safetyScreening: CLEAR_SAFETY_SCREENING,
            catalog,
            datasetVersion: "fixture-v1",
            seed,
          });
          expect(result.ok, !result.ok ? JSON.stringify(result) : undefined).toBe(true);
          if (!result.ok) return;

          const ids = result.plan.days.flatMap((day) =>
            day.exercises.map((exercise) => exercise.exerciseId),
          );
          expect(result.plan.days).toHaveLength(daysPerWeek);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.every((id) => catalog.some((exercise) => exercise.id === id))).toBe(true);
          expect(result.validation.valid).toBe(true);
          for (const day of result.plan.days) {
            expect(day.estimatedMinutes).toBeGreaterThanOrEqual(
              sessionMinutes - 5,
            );
            expect(day.estimatedMinutes).toBeLessThanOrEqual(sessionMinutes + 6);
            expect(day.exercises.every((exercise) => exercise.rir !== null)).toBe(true);
          }
        },
      ),
      { numRuns: 120 },
    );
  });
});
