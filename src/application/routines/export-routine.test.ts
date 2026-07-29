import { describe, expect, it } from "vitest";

import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import type { RoutinePlan } from "@/domain/routine/schemas";

import {
  createRoutineTextExport,
  routineExportFilename,
} from "./export-routine";

const catalog = [
  {
    id: "press-01",
    name: "Press inclinado con mancuernas",
  } as CatalogExercise,
];

const plan = {
  id: "routine-export",
  title: "Hipertrofia · 4 días",
  goal: "hypertrophy",
  daysPerWeek: 1,
  summary: "Plan validado.",
  splitId: "full-body",
  splitName: "Cuerpo completo",
  days: [
    {
      id: "day-1",
      name: "Cuerpo completo A",
      focus: ["chest", "back"],
      estimatedMinutes: 60,
      sessionBlocks: [
        {
          kind: "general_warmup",
          title: "Entrada en calor general",
          description: "Movimiento suave y progresivo.",
          estimatedMinutes: 6,
          relatedExerciseIds: [],
        },
      ],
      exercises: [
        {
          exerciseId: "press-01",
          sets: 3,
          repPrescription: "8–12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: ["Técnica controlada."],
          selectionReasons: ["Compatible."],
        },
      ],
    },
  ],
  warnings: ["Duración estimada."],
  assumptions: ["Equipamiento completo."],
  generatedAt: "2026-07-29T12:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "dataset-test",
  seed: "export",
} satisfies RoutinePlan;

describe("routine text export", () => {
  it("creates a portable Spanish plan without embedding protected media URLs", () => {
    const exported = createRoutineTextExport({
      plan,
      catalog,
      origin: "https://app.forma-gym.workers.dev/",
    });

    expect(exported.text).toContain("FORMA · RUTINA VALIDADA");
    expect(exported.text).toContain("Press inclinado con mancuernas");
    expect(exported.text).toContain("Entrada en calor general: 6 min");
    expect(exported.text).toContain("3 series · 8–12 repeticiones · 90 s de descanso · RIR 2");
    expect(exported.text).toContain(
      "https://app.forma-gym.workers.dev/ejercicios/press-01",
    );
    expect(exported.text).toContain(
      "https://app.forma-gym.workers.dev/atribuciones",
    );
    expect(exported.text).not.toMatch(/source-media|exercise-media|\.gif|\.jpg/u);
  });

  it("builds a stable filesystem-safe filename", () => {
    expect(routineExportFilename(plan)).toBe("forma-hipertrofia-4-dias.txt");
  });
});
