import type { LicensedMediaReplacement } from "@/media";

import replacementsDocument from "./curated/exercise-media-overrides.json";

type LicensedReplacementDocument = {
  overrides: Record<string, LicensedMediaReplacement>;
};

const replacements = (replacementsDocument as LicensedReplacementDocument).overrides;

/** Reviewed, separately licensed public replacements; empty until the launch gate is cleared. */
export function getLicensedMediaReplacements(): Readonly<
  Record<string, LicensedMediaReplacement>
> {
  return replacements;
}
