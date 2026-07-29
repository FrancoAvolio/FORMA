"use client";

import {
  createRoutinePdfExport,
  routineExerciseIds,
  RoutineExerciseExportDetailsDocumentSchema,
  type RoutineExerciseExportDetail,
  type RoutineExportCatalog,
  type RoutinePdfMediaCatalog,
} from "@/application/routines/routine-pdf-export";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";

export type PreparedRoutinePdf = {
  blob: Blob;
  filename: string;
  title: string;
};

type FetchLike = typeof fetch;

function mediaFor(
  media: RoutinePdfMediaCatalog,
  exerciseId: string,
): ExerciseMedia | undefined {
  const maybeMap = media as ReadonlyMap<string, ExerciseMedia>;
  return typeof maybeMap.get === "function"
    ? maybeMap.get(exerciseId)
    : (media as Readonly<Record<string, ExerciseMedia>>)[exerciseId];
}

function absoluteUrl(url: string, origin: string): string {
  return new URL(url, origin).toString();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

export async function fetchPdfImageDataUrl(
  url: string,
  fetcher: FetchLike = fetch,
): Promise<string> {
  const response = await fetcher(url, { credentials: "same-origin" });
  if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status}).`);

  const contentType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    throw new Error("El formato de imagen no es compatible con el PDF.");
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > 2_000_000) {
    throw new Error("La imagen está vacía o supera el tamaño permitido.");
  }
  return `data:${contentType};base64,${arrayBufferToBase64(buffer)}`;
}

export async function loadRoutinePdfImages({
  exerciseIds,
  media,
  origin,
  fetcher = fetch,
  concurrency = 4,
}: {
  exerciseIds: readonly string[];
  media: RoutinePdfMediaCatalog;
  origin: string;
  fetcher?: FetchLike;
  concurrency?: number;
}): Promise<ReadonlyMap<string, string>> {
  const candidates = exerciseIds.flatMap((exerciseId) => {
    const exerciseMedia = mediaFor(media, exerciseId);
    return exerciseMedia?.available
      ? [
          {
            exerciseId,
            url: absoluteUrl(exerciseMedia.thumbnailUrl, origin),
          },
        ]
      : [];
  });
  const results = new Map<string, string>();
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(Math.trunc(concurrency), 4, candidates.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < candidates.length) {
        const candidate = candidates[cursor];
        cursor += 1;
        if (!candidate) continue;
        try {
          results.set(
            candidate.exerciseId,
            await fetchPdfImageDataUrl(candidate.url, fetcher),
          );
        } catch {
          // A missing or unsupported thumbnail must not prevent the routine export.
        }
      }
    }),
  );

  return results;
}

export async function loadRoutinePdfDetails(
  exerciseIds: readonly string[],
): Promise<readonly RoutineExerciseExportDetail[]> {
  const generatedModule = await import(
    "@/data/generated/routine-export-details.json"
  );
  const document = RoutineExerciseExportDetailsDocumentSchema.parse(
    generatedModule.default,
  );
  const byId = new Map(
    document.exercises.map((exercise) => [exercise.id, exercise]),
  );

  return exerciseIds.map((exerciseId) => {
    const detail = byId.get(exerciseId);
    if (!detail) {
      throw new Error(`Faltan instrucciones validadas para ${exerciseId}.`);
    }
    return {
      id: detail.id,
      instructionsEs: detail.instructionStepsEs.join(" "),
      instructionStepsEs: detail.instructionStepsEs,
      sourceAttribution: document.sourceAttribution,
    };
  });
}

export async function prepareRoutinePdf({
  plan,
  catalog,
  media,
  origin,
}: {
  plan: RoutinePlan;
  catalog: RoutineExportCatalog;
  media: RoutinePdfMediaCatalog;
  origin: string;
}): Promise<PreparedRoutinePdf> {
  const exerciseIds = routineExerciseIds(plan);
  const [details, imageDataUrls, renderer, documentModule] = await Promise.all([
    loadRoutinePdfDetails(exerciseIds),
    loadRoutinePdfImages({ exerciseIds, media, origin }),
    import("@react-pdf/renderer"),
    import("@/components/routines/routine-pdf-document"),
  ]);
  const data = createRoutinePdfExport({
    plan,
    catalog,
    media,
    details,
    imageDataUrls,
    origin,
  });
  const blob = await renderer
    .pdf(<documentModule.RoutinePdfDocument data={data} />)
    .toBlob();

  if (blob.size === 0) throw new Error("El PDF generado está vacío.");
  return {
    blob: blob.type === "application/pdf" ? blob : blob.slice(0, blob.size, "application/pdf"),
    filename: data.filename,
    title: data.title,
  };
}
