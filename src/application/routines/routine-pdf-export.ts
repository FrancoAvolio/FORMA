import { z } from "zod";

import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import { rirToRpe } from "@/domain/routine/engine/assign-prescription";
import type {
  RoutinePlan,
  RoutineSessionBlock,
} from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";
import {
  exerciseLabel,
  exerciseListLabel,
} from "@/presentation/exercise-labels";

export const RoutineExerciseExportDetailSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    instructionsEs: z.string().trim().min(1).max(4_000),
    instructionStepsEs: z.array(z.string().trim().min(1).max(1_000)).min(1).max(64),
    sourceAttribution: z.string().trim().min(1).max(500),
  })
  .strict();

export const RoutineExerciseExportDetailsResponseSchema = z
  .object({
    exercises: z.array(RoutineExerciseExportDetailSchema).max(72),
  })
  .strict();

export const RoutineExerciseExportDetailsDocumentSchema = z
  .object({
    schemaVersion: z.literal(1),
    datasetCommit: z.string().trim().min(1).max(160),
    sourceAttribution: z.string().trim().min(1).max(500),
    exercises: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(128),
            instructionStepsEs: z
              .array(z.string().trim().min(1).max(1_000))
              .min(1)
              .max(64),
          })
          .strict(),
      )
      .max(156),
  })
  .strict();

export type RoutineExerciseExportDetail = z.infer<
  typeof RoutineExerciseExportDetailSchema
>;

export type RoutineExportCatalog =
  | readonly CatalogExercise[]
  | ReadonlyMap<string, CatalogExercise>;

export type RoutinePdfMediaCatalog =
  | Readonly<Record<string, ExerciseMedia>>
  | ReadonlyMap<string, ExerciseMedia>;

export type RoutinePdfExercise = {
  id: string;
  position: number;
  name: string;
  bodyPart: string;
  difficulty: string;
  muscles: string;
  secondaryMuscles: string;
  equipment: string;
  prescription: {
    sets: number;
    repetitions: string;
    restSeconds: number;
    rir: number | null;
    rpe: number | null;
    tempo: string | null;
  };
  notes: readonly string[];
  selectionReasons: readonly string[];
  instructionSteps: readonly string[];
  instructionsFallback: string;
  imageDataUrl: string | null;
  mediaAttribution: string | null;
  sourceAttribution: string | null;
  detailUrl: string;
};

export type RoutinePdfDay = {
  id: string;
  position: number;
  name: string;
  focus: string;
  estimatedMinutes: number;
  sessionBlocks: readonly RoutineSessionBlock[];
  exercises: readonly RoutinePdfExercise[];
};

export type RoutinePdfExport = {
  filename: string;
  title: string;
  summary: string;
  goal: string;
  splitName: string;
  daysPerWeek: number;
  totalMinutes: number;
  totalExercises: number;
  generatedAt: string;
  engineVersion: string;
  datasetVersion: string;
  days: readonly RoutinePdfDay[];
  warnings: readonly string[];
  assumptions: readonly string[];
  attributionsUrl: string;
  uniqueMediaAttributions: readonly string[];
  uniqueSourceAttributions: readonly string[];
};

function toExerciseMap(
  catalog: RoutineExportCatalog,
): ReadonlyMap<string, CatalogExercise> {
  return Array.isArray(catalog)
    ? new Map(catalog.map((exercise) => [exercise.id, exercise]))
    : (catalog as ReadonlyMap<string, CatalogExercise>);
}

function mediaFor(
  media: RoutinePdfMediaCatalog,
  exerciseId: string,
): ExerciseMedia | undefined {
  const maybeMap = media as ReadonlyMap<string, ExerciseMedia>;
  return typeof maybeMap.get === "function"
    ? maybeMap.get(exerciseId)
    : (media as Readonly<Record<string, ExerciseMedia>>)[exerciseId];
}

function normalizedOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/u, "");
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 64);
}

export function routinePdfExportFilename(plan: RoutinePlan): string {
  return `forma-${safeFilenamePart(plan.title) || "rutina"}.pdf`;
}

export function routineExerciseIds(plan: RoutinePlan): readonly string[] {
  return [
    ...new Set(
      plan.days.flatMap((day) =>
        day.exercises.map((exercise) => exercise.exerciseId),
      ),
    ),
  ];
}

export function createRoutinePdfExport({
  plan,
  catalog,
  media,
  details,
  imageDataUrls,
  origin,
}: {
  plan: RoutinePlan;
  catalog: RoutineExportCatalog;
  media: RoutinePdfMediaCatalog;
  details: readonly RoutineExerciseExportDetail[];
  imageDataUrls?: ReadonlyMap<string, string>;
  origin: string;
}): RoutinePdfExport {
  const exercisesById = toExerciseMap(catalog);
  const detailsById = new Map(details.map((detail) => [detail.id, detail]));
  const baseUrl = normalizedOrigin(origin);
  const uniqueMediaAttributions = new Set<string>();
  const uniqueSourceAttributions = new Set<string>();

  const days = plan.days.map((day, dayIndex): RoutinePdfDay => ({
    id: day.id,
    position: dayIndex + 1,
    name: day.name,
    focus: exerciseListLabel(day.focus),
    estimatedMinutes: day.estimatedMinutes,
    sessionBlocks: day.sessionBlocks ?? [],
    exercises: day.exercises.map((prescription, exerciseIndex) => {
      const exercise = exercisesById.get(prescription.exerciseId);
      const detail = detailsById.get(prescription.exerciseId);
      const exerciseMedia = mediaFor(media, prescription.exerciseId);
      if (exerciseMedia?.attribution) {
        uniqueMediaAttributions.add(exerciseMedia.attribution);
      }
      if (detail?.sourceAttribution) {
        uniqueSourceAttributions.add(detail.sourceAttribution);
      }

      return {
        id: prescription.exerciseId,
        position: exerciseIndex + 1,
        name: exercise?.name ?? `Ejercicio ${prescription.exerciseId}`,
        bodyPart: exercise ? exerciseLabel(exercise.bodyPart) : "Sin clasificar",
        difficulty: exercise
          ? exerciseLabel(exercise.difficulty)
          : "Sin clasificar",
        muscles: exercise
          ? exerciseListLabel(exercise.primaryMuscles)
          : "Ejercicio validado del catálogo",
        secondaryMuscles:
          exercise && exercise.secondaryMuscles.length > 0
            ? exerciseListLabel(exercise.secondaryMuscles)
            : "—",
        equipment: exercise
          ? exercise.equipment.map(exerciseLabel).join(", ")
          : "Consultar ficha",
        prescription: {
          sets: prescription.sets,
          repetitions: prescription.repPrescription,
          restSeconds: prescription.restSeconds,
          rir: prescription.rir,
          rpe: prescription.rir === null ? null : rirToRpe(prescription.rir),
          tempo: prescription.tempo,
        },
        notes: prescription.notes,
        selectionReasons: prescription.selectionReasons,
        instructionSteps: detail?.instructionStepsEs ?? [],
        instructionsFallback:
          detail?.instructionsEs ??
          "Abrí la ficha del ejercicio para revisar la ejecución completa.",
        imageDataUrl:
          exerciseMedia?.available === true
            ? (imageDataUrls?.get(prescription.exerciseId) ?? null)
            : null,
        mediaAttribution: exerciseMedia?.attribution ?? null,
        sourceAttribution: detail?.sourceAttribution ?? null,
        detailUrl: `${baseUrl}/ejercicios/${encodeURIComponent(prescription.exerciseId)}`,
      };
    }),
  }));

  return {
    filename: routinePdfExportFilename(plan),
    title: plan.title,
    summary: plan.summary,
    goal: plan.goal,
    splitName: plan.splitName,
    daysPerWeek: plan.daysPerWeek,
    totalMinutes: days.reduce((total, day) => total + day.estimatedMinutes, 0),
    totalExercises: days.reduce(
      (total, day) => total + day.exercises.length,
      0,
    ),
    generatedAt: plan.generatedAt,
    engineVersion: plan.engineVersion,
    datasetVersion: plan.datasetVersion,
    days,
    warnings: plan.warnings,
    assumptions: plan.assumptions,
    attributionsUrl: `${baseUrl}/atribuciones`,
    uniqueMediaAttributions: [...uniqueMediaAttributions],
    uniqueSourceAttributions: [...uniqueSourceAttributions],
  };
}
