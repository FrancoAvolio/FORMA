import { describe, expect, it } from "vitest";

import type { RoutinePlan } from "../../domain/routine/schemas";
import { createCatalog } from "../../domain/routine/__tests__/fixtures";
import { resolveConversationQuestion } from "./resolve-conversation-question";

const catalog = createCatalog();
const exercise = catalog.find((candidate) => candidate.movementPattern === "horizontal_pull")!;
const plan = {
  id: "question-plan",
  title: "Plan",
  goal: "hypertrophy",
  daysPerWeek: 1,
  summary: "Plan validado",
  splitId: "full-body-1",
  splitName: "Cuerpo completo",
  days: [
    {
      id: "day-1",
      name: "Día 1",
      focus: ["back"],
      estimatedMinutes: 30,
      exercises: [
        {
          exerciseId: exercise.id,
          sets: 3,
          repPrescription: "8–12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: [],
          selectionReasons: ["Prioriza espalda."],
        },
      ],
    },
  ],
  warnings: [],
  assumptions: [],
  generatedAt: "2026-07-28T00:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "test",
  seed: "test",
} satisfies RoutinePlan;

describe("resolveConversationQuestion", () => {
  it("grounds a named exercise question in its actual plan placement", () => {
    expect(
      resolveConversationQuestion({
        message: `¿Por qué elegiste ${exercise.name}?`,
        plan,
        catalog,
      }),
    ).toEqual({
      kind: "exercise",
      questionKind: "selection_reason",
      target: { exerciseId: exercise.id, dayId: "day-1" },
      requiredAlternativeEquipment: [],
    });
  });

  it("uses an explicitly selected exercise for contextual pronouns", () => {
    expect(
      resolveConversationQuestion({
        message: "¿Cómo se hace este ejercicio?",
        plan,
        catalog,
        activeExercise: { exerciseId: exercise.id, dayId: "day-1" },
      }),
    ).toMatchObject({ kind: "exercise", questionKind: "instructions" });
  });

  it("does not guess an exercise that is not named or selected", () => {
    expect(
      resolveConversationQuestion({
        message: "¿Qué trabaja este ejercicio?",
        plan,
        catalog,
      }),
    ).toEqual({ kind: "unknown" });
  });

  it("grounds an equipment-constrained alternative in the selected exercise", () => {
    expect(
      resolveConversationQuestion({
        message: "¿Tenés otra opción con polea?",
        plan,
        catalog,
        activeExercise: { exerciseId: exercise.id, dayId: "day-1" },
      }),
    ).toMatchObject({
      kind: "exercise",
      questionKind: "alternatives",
      requiredAlternativeEquipment: ["cable"],
    });
  });

  it("resolves a short exercise token inside the active day", () => {
    const renamedCatalog = catalog.map((candidate) =>
      candidate.id === exercise.id
        ? { ...candidate, name: "Remo con cable" }
        : candidate,
    );
    expect(
      resolveConversationQuestion({
        message: "Explicame por qué pusiste remo en este día",
        plan,
        catalog: renamedCatalog,
        activeDayId: "day-1",
      }),
    ).toMatchObject({
      kind: "exercise",
      questionKind: "selection_reason",
      target: { exerciseId: exercise.id, dayId: "day-1" },
    });
  });

  it("recognizes a full-routine explanation question", () => {
    expect(
      resolveConversationQuestion({
        message: "¿Por qué dividiste así la rutina semanal?",
        plan,
        catalog,
      }),
    ).toEqual({ kind: "routine_explanation" });
  });
});
