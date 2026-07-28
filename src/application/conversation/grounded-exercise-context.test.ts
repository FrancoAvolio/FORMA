import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { RoutineRequest } from "@/domain/profile/routine-request";
import type { RoutinePlan } from "@/domain/routine/schemas";

import {
  GROUNDED_EXERCISE_CONTEXT_LIMITS,
  resolveGroundedExerciseContext,
} from "./grounded-exercise-context";

const request: RoutineRequest = {
  goal: "hypertrophy",
  experience: "intermediate",
  daysPerWeek: 1,
  sessionMinutes: 60,
  trainingLocation: "commercial_gym",
  availableEquipment: [],
  focusMuscles: ["chest"],
  excludedExercises: [],
  excludedMovementPatterns: [],
  preferredExercises: [],
  limitations: [],
  notes: null,
};

function createPlan(exerciseId = "0025"): RoutinePlan {
  return {
    id: "grounded-context-plan",
    title: "Rutina de prueba",
    goal: "hypertrophy",
    daysPerWeek: 1,
    summary: "Plan validado para probar respuestas basadas en el catálogo.",
    splitId: "full-body-1",
    splitName: "Cuerpo completo",
    days: [
      {
        id: "day-1",
        name: "Día 1",
        focus: ["chest"],
        estimatedMinutes: 45,
        exercises: [
          {
            exerciseId,
            sets: 3,
            repPrescription: "8–12",
            restSeconds: 90,
            rir: 2,
            tempo: null,
            notes: ["Mantené una técnica controlada."],
            selectionReasons: [
              "Coincide con el foco del día y el equipamiento disponible.",
            ],
          },
        ],
      },
    ],
    warnings: [],
    assumptions: [],
    generatedAt: "2026-07-28T12:00:00.000Z",
    engineVersion: "test-engine",
    datasetVersion: "7455efae41b330c265e7cd4b78dfa848e7ce5ebd",
    seed: "grounded-context-seed",
  };
}

describe("resolveGroundedExerciseContext", () => {
  it("resolves Spanish instructions and curated facts from a routine position", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "instructions",
      target: { dayId: "day-1", exerciseIndex: 0 },
      routinePlan: createPlan(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.context.exercise).toMatchObject({
      id: "0025",
      displayNameEs: "Press de banca con barra",
      sourceName: "barbell bench press",
      primaryMuscles: ["pectorals"],
      requiredEquipment: ["barbell", "barbell_rack", "bench"],
      approvedForGeneration: true,
      difficulty: "intermediate",
      movementPattern: "horizontal_push",
      modality: "compound",
      substitutionGroup: "horizontal_push:chest",
    });
    expect(result.context.exercise.instructionsEs.length).toBeGreaterThan(0);
    expect(result.context.exercise.instructionStepsEs.length).toBeGreaterThan(0);
    expect(result.context.exercise.instructionStepsEs.length).toBeLessThanOrEqual(
      GROUNDED_EXERCISE_CONTEXT_LIMITS.instructionSteps,
    );
    expect(result.context.exercise.sourceAttribution).toContain(
      "hasaneyldrm/exercises-dataset",
    );
    expect(result.context.exercise.media).toMatchObject({
      available: true,
      hasThumbnail: true,
      hasAnimation: true,
      mediaRef: "0025",
    });
    expect(result.context.exercise.media.attribution).toContain("gymvisual.com");
    expect(result.context.routine).toMatchObject({
      planId: "grounded-context-plan",
      dayId: "day-1",
      exerciseIndex: 0,
      selectionReasons: [
        "Coincide con el foco del día y el equipamiento disponible.",
      ],
    });
    expect(result.context.grounding).toMatchObject({
      source: "validated_local_catalog",
      routineContextSource: "current_routine_plan",
    });
  });

  it("returns only stored deterministic plan reasons for a selection question", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "selection_reason",
      target: { exerciseId: "0025", dayId: "day-1" },
      routinePlan: createPlan(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.routine?.selectionReasons).toEqual([
      "Coincide con el foco del día y el equipamiento disponible.",
    ]);
    expect(result.context.alternatives).toEqual([]);
  });

  it("returns deterministic approved alternatives compatible with a requested cable", () => {
    const input = {
      questionKind: "alternatives" as const,
      target: { exerciseId: "0025", dayId: "day-1" },
      routinePlan: createPlan(),
      routineRequest: request,
      alternativesLimit: 2,
      requiredAlternativeEquipment: ["polea"],
    };
    const first = resolveGroundedExerciseContext(input);
    const second = resolveGroundedExerciseContext(input);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.context.alternativeConstraints).toEqual({
      requiredEquipment: ["cable"],
    });
    expect(first.context.alternatives.length).toBeGreaterThan(0);
    expect(first.context.alternatives.length).toBeLessThanOrEqual(2);
    for (const alternative of first.context.alternatives) {
      expect(alternative.id).toMatch(/^\d{4}$/u);
      expect(alternative.id).not.toBe("0025");
      expect(alternative.requiredEquipment).toContain("cable");
      expect(alternative.primaryMuscles).toContain("pectorals");
      expect(alternative.compatibilityReasons).toContain(
        "Cumple el equipamiento y las exclusiones de la solicitud validada.",
      );
      expect(alternative.compatibilityReasons.length).toBeLessThanOrEqual(
        GROUNDED_EXERCISE_CONTEXT_LIMITS.alternativeReasons,
      );
    }
  });

  it("answers catalog questions for an unreviewed record without approving it", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "muscles",
      target: { exerciseId: "0125" },
      routinePlan: null,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.exercise).toMatchObject({
      id: "0125",
      displayNameEs: null,
      approvedForGeneration: false,
      reviewStatus: "unreviewed",
      substitutionGroup: null,
    });
    expect(result.context.exercise.instructionsEs.length).toBeGreaterThan(0);
    expect(result.context.routine).toBeNull();
  });

  it("refuses substitutions for a record outside the approved routine catalog", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "alternatives",
      target: { exerciseId: "0125" },
      routinePlan: null,
      routineRequest: request,
    });

    expect(result).toEqual({
      ok: false,
      code: "EXERCISE_NOT_APPROVED",
      message:
        "Ese ejercicio no pertenece al catálogo curado para generar sustituciones.",
    });
  });

  it("does not invent a context for an unknown exercise ID", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "overview",
      target: { exerciseId: "9999" },
      routinePlan: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "EXERCISE_NOT_FOUND",
      message: "El ejercicio indicado no existe en el catálogo local validado.",
    });
  });

  it("requires a real routine occurrence before explaining a selection", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "selection_reason",
      target: { exerciseId: "0025" },
      routinePlan: null,
    });

    expect(result).toEqual({
      ok: false,
      code: "EXERCISE_NOT_IN_ROUTINE",
      message:
        "No hay una selección de ese ejercicio en la rutina actual para explicar.",
    });
  });

  it("rejects a routine context containing an ID outside the approved catalog", () => {
    const result = resolveGroundedExerciseContext({
      questionKind: "overview",
      target: { exerciseId: "0025" },
      routinePlan: createPlan("9999"),
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_ROUTINE_CONTEXT",
      message:
        "La rutina actual contiene un ejercicio que no pertenece al catálogo aprobado.",
    });
  });
});
