# Controlled exercise-media import

The pipeline imports exactly the approved upstream commit and never uses GitHub as a runtime media host.

## First local import

```bash
node scripts/fetch-dataset.mjs
node scripts/import-dataset.mjs --source .local-media/source-repo
node scripts/import-media.mjs --source .local-media/source-repo
node scripts/generate-curation.mjs
node scripts/validate-curated.mjs
node scripts/build-catalog.mjs
node scripts/validate-media.mjs --require-local
node scripts/audit-catalog.mjs
```

Outputs:

- Immutable source JSON, schema, license and notice: `src/data/source/`.
- Protected binaries: `.local-media/exercises-dataset/images/` and `.local-media/exercises-dataset/videos/`.
- Tracked relationship and integrity manifest: `src/data/generated/media-index.json`.
- Compact server runtime manifest without binary hashes or remote URLs: `src/data/generated/media-runtime.json`.
- Neutral fallback: `public/exercises/placeholders/exercise-media.svg`.

The `.local-media` directory ignores everything except its own `.gitignore`; binaries cannot be committed accidentally. The import script refuses a destination outside that directory, validates the source Git commit, requires an exact one-to-one dataset/media inventory, checks JPEG/GIF headers and dimensions, hashes every binary and preserves original filenames. It also recomputes each file's Git blob object ID and compares it with the tree of the pinned commit, so a dirty or same-size modified checkout cannot be imported.

## Runtime delivery

Protected media is resolved centrally to `/api/exercise-media/images/` and `/api/exercise-media/videos/` only in local-private mode. The implemented server route accepts only manifest-listed basenames from the fixed ignored directory, rejects traversal and unknown files, and returns 404 outside development/private evaluation.

The central resolver in `src/media/exercise-media-resolver.ts` always converts `local_private` to disabled in production. A production build therefore displays the static placeholder and keeps Spanish instructions, search and deterministic generation working.

## Validation modes

```bash
# Offline structural validation; local binaries are optional.
node scripts/validate-media.mjs

# Private-development verification; every imported binary is required.
node scripts/validate-media.mjs --require-local
```

Both modes fail if protected source filenames are found in public production-controlled directories. Content hashes are checked for every artifact file regardless of its extension, so renaming a protected binary does not bypass the gate.
