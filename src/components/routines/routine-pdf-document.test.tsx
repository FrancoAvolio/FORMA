import { pdf } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import type { RoutinePdfExport } from "@/application/routines/routine-pdf-export";

import { RoutinePdfDocument } from "./routine-pdf-document";

const tinyPng =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADklEQVQImWP4DwYMEAoAU7oL9W/sIDEAAAAASUVORK5CYII=";

const data: RoutinePdfExport = {
  filename: "forma-rutina.pdf",
  title: "Hipertrofia · 1 día",
  summary: "Rutina validada con una explicación completa por ejercicio.",
  goal: "hypertrophy",
  splitName: "Cuerpo completo",
  daysPerWeek: 1,
  totalMinutes: 60,
  totalExercises: 1,
  generatedAt: "2026-07-29T12:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "dataset-test",
  days: [
    {
      id: "day-1",
      position: 1,
      name: "Cuerpo completo A",
      focus: "Pecho, Espalda",
      estimatedMinutes: 60,
      sessionBlocks: [
        {
          kind: "general_warmup",
          title: "Entrada en calor",
          description: "Preparación progresiva.",
          estimatedMinutes: 6,
          relatedExerciseIds: [],
        },
      ],
      exercises: [
        {
          id: "0025",
          position: 1,
          name: "Press de banca con barra",
          bodyPart: "Pecho",
          difficulty: "Intermedio",
          muscles: "Pectorales",
          secondaryMuscles: "Tríceps",
          equipment: "Barra, banco",
          prescription: {
            sets: 3,
            repetitions: "8–12",
            restSeconds: 90,
            rir: 2,
            rpe: 8,
            tempo: null,
          },
          notes: ["Mantené la técnica controlada."],
          selectionReasons: ["Compatible con el objetivo y el equipamiento."],
          instructionSteps: [
            "Apoyá los pies y la espalda sobre el banco.",
            "Bajá la barra con control y empujá sin perder la posición.",
          ],
          instructionsFallback: "Abrí la ficha para revisar la ejecución.",
          imageDataUrl: tinyPng,
          mediaAttribution: "© Gym visual — https://gymvisual.com/",
          sourceAttribution: "dataset @ commit",
          detailUrl: "https://app.forma-gym.workers.dev/ejercicios/0025",
        },
      ],
    },
  ],
  warnings: ["La duración es estimada."],
  assumptions: ["Equipamiento completo."],
  attributionsUrl: "https://app.forma-gym.workers.dev/atribuciones",
  uniqueMediaAttributions: ["© Gym visual — https://gymvisual.com/"],
  uniqueSourceAttributions: ["dataset @ commit"],
};

describe("RoutinePdfDocument", () => {
  it("renders a real, paginated PDF with an embedded image and links", async () => {
    const blob = await pdf(<RoutinePdfDocument data={data} />).toBlob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const header = new TextDecoder("latin1").decode(bytes.slice(0, 8));
    const source = new TextDecoder("latin1").decode(bytes);

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(5_000);
    expect(header).toMatch(/^%PDF-/u);
    expect(source.match(/\/Type \/Page\b/gu)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(source).toContain("/Subtype /Image");
    expect(source).toContain("/Subtype /Link");
    expect(source).not.toContain(".gif");
  }, 15_000);
});
