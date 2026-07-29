export const EXERCISE_MEDIA_PLACEHOLDER =
  "/exercises/placeholders/exercise-media.svg" as const;

export type ExerciseMediaMode =
  | "disabled"
  | "local_private"
  | "licensed_replacements"
  | "owner_authorized_source";
export type ExerciseMediaUnavailableReason =
  | "disabled_by_configuration"
  | "production_license_pending"
  | "missing_manifest_entry"
  | "licensed_replacement_missing";

export type ProtectedMediaManifestEntry = {
  exerciseId: string;
  attribution: string;
  canonicalAttribution: string;
  protectedMedia: true;
  productionDistribution: "disabled_pending_license_review";
  thumbnail: {
    filename: string;
    width: number;
    height: number;
  };
  animation: {
    filename: string;
    width: number;
    height: number;
  };
};

export type LicensedMediaReplacement = {
  thumbnailUrl: string;
  animationUrl?: string | null;
  attribution: string;
  licenseReference: string;
};

export type ExerciseMedia = {
  exerciseId: string;
  available: boolean;
  thumbnailUrl: string;
  animationUrl: string | null;
  width: number;
  height: number;
  attribution: string | null;
  protectedMedia: boolean;
  unavailableReason: ExerciseMediaUnavailableReason | null;
};

export interface ExerciseMediaResolver {
  getMedia(exerciseId: string): ExerciseMedia;
}

export type ExerciseMediaResolverOptions = {
  requestedMode: ExerciseMediaMode;
  runtime: "development" | "test" | "production";
  manifestEntries: readonly ProtectedMediaManifestEntry[];
  licensedReplacements?: Readonly<Record<string, LicensedMediaReplacement>>;
};

const SAFE_REPLACEMENT_URL =
  /^\/exercises\/replacements\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif)$/u;

function placeholder(
  exerciseId: string,
  reason: ExerciseMediaUnavailableReason,
): ExerciseMedia {
  return {
    exerciseId,
    available: false,
    thumbnailUrl: EXERCISE_MEDIA_PLACEHOLDER,
    animationUrl: null,
    width: 180,
    height: 180,
    attribution: null,
    protectedMedia: false,
    unavailableReason: reason,
  };
}

function validateReplacement(exerciseId: string, replacement: LicensedMediaReplacement): void {
  if (!SAFE_REPLACEMENT_URL.test(replacement.thumbnailUrl)) {
    throw new Error(`Unsafe licensed thumbnail URL for exercise ${exerciseId}.`);
  }
  if (replacement.animationUrl && !SAFE_REPLACEMENT_URL.test(replacement.animationUrl)) {
    throw new Error(`Unsafe licensed animation URL for exercise ${exerciseId}.`);
  }
  if (!replacement.attribution.trim() || !replacement.licenseReference.trim()) {
    throw new Error(`Licensed replacement ${exerciseId} requires attribution and a license reference.`);
  }
}

/**
 * Local source media remains development-only. Production source media has a
 * separate, explicit owner-authorized mode and a static-assets namespace so it
 * cannot be enabled accidentally by the local development flag.
 */
export function createExerciseMediaResolver(
  options: ExerciseMediaResolverOptions,
): ExerciseMediaResolver {
  const entries = new Map(options.manifestEntries.map((entry) => [entry.exerciseId, entry]));
  const effectiveMode: ExerciseMediaMode =
    options.runtime === "production" && options.requestedMode === "local_private"
      ? "disabled"
      : options.requestedMode;

  return {
    getMedia(exerciseId) {
      if (effectiveMode === "disabled") {
        return placeholder(
          exerciseId,
          options.runtime === "production" && options.requestedMode === "local_private"
            ? "production_license_pending"
            : "disabled_by_configuration",
        );
      }

      if (effectiveMode === "licensed_replacements") {
        const replacement = options.licensedReplacements?.[exerciseId];
        if (!replacement) return placeholder(exerciseId, "licensed_replacement_missing");
        validateReplacement(exerciseId, replacement);
        return {
          exerciseId,
          available: true,
          thumbnailUrl: replacement.thumbnailUrl,
          animationUrl: replacement.animationUrl ?? null,
          width: 180,
          height: 180,
          attribution: replacement.attribution,
          protectedMedia: false,
          unavailableReason: null,
        };
      }

      const entry = entries.get(exerciseId);
      if (!entry) return placeholder(exerciseId, "missing_manifest_entry");
      const mediaBaseUrl =
        effectiveMode === "owner_authorized_source"
          ? "/exercises/source-media"
          : "/api/exercise-media";
      return {
        exerciseId,
        available: true,
        thumbnailUrl: `${mediaBaseUrl}/images/${entry.thumbnail.filename}`,
        animationUrl: `${mediaBaseUrl}/videos/${entry.animation.filename}`,
        width: entry.thumbnail.width,
        height: entry.thumbnail.height,
        attribution: entry.attribution,
        protectedMedia: true,
        unavailableReason: null,
      };
    },
  };
}
