# Implementation log

This log records material implementation work and validation evidence. It complements Git history; it does not replace it.

## 2026-07-25 — Preservation and foundation

- Consolidated the authoritative repository instructions in `AGENTS.md` and removed duplicate stale instruction files.
- Preserved every Stitch reference byte-for-byte and added `docs/DESIGN_REFERENCE_MANIFEST.json` with SHA-256 checksums, byte sizes and image dimensions.
- Committed the preservation boundary separately as `ff685cf` before application changes.
- Pinned the source dataset commit to `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`.
- Moved the Next.js application into `src/app` and established Node 22, TypeScript, Vitest and Playwright foundations.
- Started the dataset/media pipeline, deterministic routine engine and provider-neutral AI layer as independent workstreams.

## 2026-07-25 — Dataset, media, and curation

- Imported and pinned 1,324 immutable source records at commit
  `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`, preserving the upstream license and notice.
- Added strict Ajv/Zod validation, normalization, MiniSearch indexes, compact/detail/runtime
  catalogs, generated-artifact freshness validation, and a reproducible audit.
- Imported 1,324 JPG plus 1,324 GIF files (137,616,454 bytes) into the ignored private-media
  root, verified every file against its Git blob, and generated protected/runtime manifests.
- Completed a source-consistency implementation review: 156 records approved for generation,
  24 valid substitution groups, 35 explicit exclusions, and 1,133 explorer-only records. The
  reviewed output is pinned by digest
  `9f1d32edb076e1a56fe68e14e2ab256e2e41bb7d8ca97f586f3b78ec1a3a0c7c`.
- Kept protected Gym Visual media outside `public`, `.next`, `.open-next`, and Git; production
  uses the explicit placeholder until the human licensing gate is cleared.

## 2026-07-25 — Deterministic domain and persistence

- Implemented strict profile, safety, exercise, prescription, day, and plan schemas.
- Implemented pure deterministic split selection, candidate filtering/scoring, seeded selection,
  prescription assignment, time/volume calculations, substitutions, full validation, and
  reproducibility from request/dataset/engine/seed.
- Added one-to-six-day configurations and real-catalog/property coverage for catalog existence,
  approval, equipment, exclusions, volume, duration, prescription bounds, and safety.
- Implemented validated application use cases for replace, remove, reorder, prescription edit,
  and single-day regeneration without regenerating unaffected days.
- Added a versioned async browser repository, schema migration, current/setup/conversation/media
  state, saved routines, and complete local-data deletion.

## 2026-07-25 — Spanish product experience

- Rebuilt the application mobile-first under `src/app`, using the immutable Stitch reference as
  visual evidence, local Geist fonts, canonical FORMA tokens, CSS Modules, and Tailwind utilities.
- Added the landing page, real-catalog media preview, seven-step guided builder, staged generation,
  explorer/filter/search, exercise details, protected-media playback, routine viewer/editor,
  saved routines, attribution, privacy, disabled-AI, failure, and safety states.
- Added responsive desktop/mobile navigation, skip/focus behavior, reduced-motion handling,
  stable media dimensions, explicit animation controls, and Spanish-Argentina metadata/copy.

## 2026-07-25 — Optional AI providers

- Added one server-only provider contract with Mock, Disabled, Ollama, and Cloudflare adapters.
- Added versioned prompts and strict schemas for routine parsing/modification, safety
  classification, and validated-plan explanation.
- Added complete JSON Schema delivery, input/output limits, deadlines/cancellation, one repair,
  typed provider/quota/rate/binding failures, privacy-safe logs, and deterministic fallback.
- Connected chat to persisted structured profile state and the same guided-form/domain generation
  entry point. Added public-route burst limiting without adding a paid service.
- Documented Ollama `qwen3:1.7b`; configured the Workers AI binding and Granite function-calling
  adapter without exposing provider configuration to the browser.

## 2026-07-25 — Production hardening

- Added OpenNext/Wrangler packaging, protected-media artifact scanning, deployment/account gates,
  production/privacy/security/accessibility documentation, and a production readiness checklist.
- Added Testing Library, Vitest unit/integration/property/contract tests and Playwright desktop,
  Pixel 7, Mock chat, no-AI, editor, persistence, real/disabled media, reduced-motion, medical
  blocking, and Axe accessibility flows.
- Remediated production dependency advisories with compatible PostCSS, sharp, and OpenNext
  build-chain overrides. Remaining ESLint-only development advisories are recorded without
  forcing an invalid peer graph.

Final command output and Cloudflare package evidence are recorded after the closing validation
run. Account-backed Ollama/Cloudflare inference and public media permission remain explicit
operator actions, not automated claims.
