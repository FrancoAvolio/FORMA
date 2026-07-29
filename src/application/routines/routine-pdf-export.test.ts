import { describe, expect, it } from "vitest";

import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";

import {
  createRoutinePdfExport,
  routineExerciseIds,
  routinePdfExportFilename,
} from "./routine-pdf-export";

const catalog = [
  {
    id: "0025",
    name: "Press de banca con barra",
    bodyPart: "chest",
    equipment: ["barbell", "bench"],
    primaryMuscles: ["pectorals"],
    secondaryMuscles: ["triceps"],
    difficulty: "intermediate",
  } as CatalogExercise,
];

const plan = {
  id: "routine-pdf",
  title: "Hipertrofia · 1 día",
  goal: "hypertrophy",
  daysPerWeek: 1,
  summary: "Plan de prueba validado.",
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
          title: "Entrada en calor",
          description: "Movimiento progresivo.",
          estimatedMinutes: 6,
          relatedExerciseIds: [],
        },
      ],
      exercises: [
        {
          exerciseId: "0025",
          sets: 3,
          repPrescription: "8–12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: ["Técnica controlada."],
          selectionReasons: ["Compatible con el objetivo."],
        },
      ],
    },
  ],
  warnings: ["Duración estimada."],
  assumptions: ["Equipamiento completo."],
  generatedAt: "2026-07-29T12:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "dataset-test",
  seed: "pdf-export",
} satisfies RoutinePlan;

const media = {
  "0025": {
    exerciseId: "0025",
    available: true,
    thumbnailUrl: "/exercises/source-media/images/0025-test.jpg",
    animationUrl: "/exercises/source-media/videos/0025-test.gif",
    width: 180,
    height: 180,
    attribution: "© Gym visual — https://gymvisual.com/",
    protectedMedia: true,
    unavailableReason: null,
  } satisfies ExerciseMedia,
};

describe("routine PDF export model", () => {
  it("keeps days, prescriptions, Spanish instructions, links and attribution", () => {
    const exported = createRoutinePdfExport({
      plan,
      catalog,
      media,
      details: [
        {
          id: "0025",
          instructionsEs: "Bajá la barra con control.",
          instructionStepsEs: [
            "Apoyá los pies y la espalda.",
            "Bajá la barra con control.",
          ],
          sourceAttribution: "dataset @ commit",
        },
      ],
      imageDataUrls: new Map([["0025", "data:image/jpeg;base64,AA=="]]),
      origin: "https://app.forma-gym.workers.dev/",
    });

    expect(exported.filename).toBe("forma-hipertrofia-1-dia.pdf");
    expect(exported.totalMinutes).toBe(60);
    expect(exported.totalExercises).toBe(1);
    expect(exported.days[0]?.focus).toBe("Pecho, Espalda");
    expect(exported.days[0]?.exercises[0]).toMatchObject({
      id: "0025",
      name: "Press de banca con barra",
      muscles: "Pectorales",
      equipment: "Barra, Banco",
      instructionSteps: [
        "Apoyá los pies y la espalda.",
        "Bajá la barra con control.",
      ],
      imageDataUrl: "data:image/jpeg;base64,AA==",
      detailUrl: "https://app.forma-gym.workers.dev/ejercicios/0025",
    });
    expect(exported.days[0]?.exercises[0]?.prescription).toMatchObject({
      sets: 3,
      repetitions: "8–12",
      restSeconds: 90,
      rir: 2,
      rpe: 8,
    });
    expect(exported.uniqueMediaAttributions).toEqual([
      "© Gym visual — https://gymvisual.com/",
    ]);
    expect(exported.uniqueSourceAttributions).toEqual(["dataset @ commit"]);
    expect(exported.attributionsUrl).toBe(
      "https://app.forma-gym.workers.dev/atribuciones",
    );
  });

  it("deduplicates exercise ids and uses a designed media fallback", () => {
    const repeatedPlan: RoutinePlan = {
      ...plan,
      days: [plan.days[0]!, { ...plan.days[0]!, id: "day-2" }],
      daysPerWeek: 2,
    };
    expect(routineExerciseIds(repeatedPlan)).toEqual(["0025"]);

    const exported = createRoutinePdfExport({
      plan,
      catalog,
      media: {
        "0025": { ...media["0025"], available: false },
      },
      details: [],
      origin: "https://app.forma-gym.workers.dev",
    });
    expect(exported.days[0]?.exercises[0]?.imageDataUrl).toBeNull();
    expect(exported.days[0]?.exercises[0]?.instructionsFallback).toContain(
      "Abrí la ficha",
    );
  });

  it("builds a stable PDF filename", () => {
    expect(routinePdfExportFilename(plan)).toBe("forma-hipertrofia-1-dia.pdf");
  });
});
