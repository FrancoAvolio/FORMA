# Replacing protected exercise media

Exercise IDs and domain logic are independent from media delivery. A licensed replacement can therefore be introduced without changing routine plans, search IDs or saved data.

## Replacement contract

1. Store reviewed replacement assets under `public/exercises/replacements/`.
2. Keep each file within the dimensions and formats permitted by its own license.
3. Add the exercise ID, safe local URL, attribution and license evidence to the reviewed
   `src/data/curated/exercise-media-overrides.json` manifest.
4. Set `EXERCISE_MEDIA_MODE=licensed_replacements`; the server-only resolver loads that
   manifest and never falls through to protected upstream media.
5. Run dataset, curated, media, accessibility and production-artifact validation.
6. Update `docs/DATA_ATTRIBUTIONS.md` and this project's licensing evidence.

The resolver accepts only local `/exercises/replacements/` URLs with JPG, PNG, WebP or GIF extensions. It rejects remote URLs and replacements without both attribution and a license reference.

`node scripts/validate-curated.mjs` also requires every referenced replacement file to
exist under `public/exercises/replacements/` before the mode can be shipped.

Do not overwrite the immutable source files or the protected local import. Do not reuse the Stitch export's remote sample imagery. If a replacement is missing, the resolver returns the neutral placeholder while instructions and programming behavior remain available.
