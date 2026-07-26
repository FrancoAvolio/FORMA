import type { ProtectedMediaManifestEntry } from "@/media";

import generatedMediaManifest from "./generated/media-runtime.json";

const entries: ProtectedMediaManifestEntry[] = generatedMediaManifest.entries.map((entry) => ({
  ...entry,
  attribution: generatedMediaManifest.attribution,
  canonicalAttribution: generatedMediaManifest.attribution,
  protectedMedia: true,
  productionDistribution: "disabled_pending_license_review",
}));

export function getProtectedMediaManifest(): readonly ProtectedMediaManifestEntry[] {
  return entries;
}

export const MEDIA_PRODUCTION_DISTRIBUTION =
  generatedMediaManifest.delivery.publicProduction;
