import "server-only";

import { getLicensedMediaReplacements } from "@/data/media-replacements";
import { getProtectedMediaManifest } from "@/data/media-manifest";

import {
  createExerciseMediaResolver,
  type ExerciseMedia,
  type ExerciseMediaMode,
} from "./exercise-media-resolver";

function configuredMode(): ExerciseMediaMode {
  if (process.env.NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA === "false") {
    return "disabled";
  }
  const mode = process.env.EXERCISE_MEDIA_MODE ?? "disabled";
  return mode === "local_private" ||
    mode === "licensed_replacements" ||
    mode === "owner_authorized_source"
    ? mode
    : "disabled";
}

const resolver = createExerciseMediaResolver({
  requestedMode: configuredMode(),
  runtime:
    process.env.NODE_ENV === "production"
      ? "production"
      : process.env.NODE_ENV === "test"
        ? "test"
        : "development",
  manifestEntries: getProtectedMediaManifest(),
  licensedReplacements: getLicensedMediaReplacements(),
});

const allowedLocalMedia = new Set(
  getProtectedMediaManifest().flatMap((entry) => [
    "images/" + entry.thumbnail.filename,
    "videos/" + entry.animation.filename,
  ]),
);

export function resolveExerciseMedia(exerciseId: string): ExerciseMedia {
  return resolver.getMedia(exerciseId);
}

export function isProtectedLocalMediaEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.EXERCISE_MEDIA_MODE === "local_private"
  );
}

export function isAllowedProtectedMediaFile(kind: string, filename: string): boolean {
  return allowedLocalMedia.has(kind + "/" + filename);
}
