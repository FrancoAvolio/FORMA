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
  build-chain overrides. Remaining ESLint and OpenNext build-chain development advisories are recorded without
  forcing an invalid peer graph.

Final command output and Cloudflare package evidence are recorded after the closing validation
run. Account-backed Ollama/Cloudflare inference and public media permission remain explicit
operator actions, not automated claims.

## 2026-07-28 — Chat-first conversational refactor

Objective: make conversation the primary creation and editing surface while retaining the guided
form as a synchronized fallback/editor. The first dependency slice simplifies the local-model
contract so providers extract only facts from the latest turn; deterministic application code
merges canonical state, derives completeness and safety, generates plans, and validates every
change.

Invariants for this phase:

- The model never derives profile completeness, final safety eligibility, exercise selection,
  duration, volume, or routine validity.
- Existing pinned dataset, protected media, curated catalog, deterministic engine, and immutable
  Stitch reference remain intact.
- Chat, form, profile, and current plan converge on one versioned repository state.
- Every AI failure preserves the current turn, canonical draft, and validated plan.
- Routine changes and exercise answers use bounded local plan/catalog context and cannot invent
  exercise IDs.

Implemented dependency slices:

- Made `/crear/chat` the canonical creation entry, redirected `/crear` to it, and moved the
  guided builder to `/crear/manual`. The landing primary action and application navigation now
  lead to conversation; the manual form remains directly available as a secondary path. These
  changes reuse the existing Stitch-derived tokens and layouts without modifying
  `docs/design-reference/**`.
- Replaced the former all-in-one parse result with a strict `ParsedRoutineTurn`: providers
  classify the latest intent and extract only an explicit request patch, latest-turn limitation
  declaration, possible safety signals, and assumptions. Pure application functions merge the
  patch, derive missing fields and completion, select at most two follow-up fields, and convert a
  complete canonical draft to `RoutineRequest`.
- Added deterministic raw-text safety reconciliation before state merge. A model can add a
  conservative signal, but it cannot remove a detected signal or grant the explicit
  no-limitations confirmation needed for generation. Final safety eligibility remains an
  application/domain result.
- Added a provider capability for natural assistant phrasing over a strictly validated context,
  plus a contextual deterministic fallback. The context contains canonical profile facts,
  deterministic completeness and safety, allowed actions, and bounded summaries of validated
  plans or retrieved exercises; it cannot change those facts.
- Added bounded server routes for turn extraction, assistant phrasing, modification parsing,
  validated-plan explanation, and grounded exercise context. Requests are schema-checked,
  size-limited, rate-guarded, cancellable, and returned with `no-store`; provider/model details
  are limited to development diagnostics.
- Added deterministic application services for chat modifications and exercise questions.
  Exercise replacements, removals, reordering, and single-day regeneration use the existing
  validated use cases; profile changes retain the plan when it is still valid and rebuild it only
  when the new request makes that necessary. Exercise answers resolve bounded facts,
  instructions, curated substitutions, selection reasons, media metadata, and attribution from
  the local validated catalog and current plan.
- Consolidated editable chat, form, safety, provider, retry, and current-plan state into the
  versioned v2 browser envelope. Repository reads and writes recompute missing fields and
  completion, normalize transient loading to idle, discard dangling retry metadata, and migrate
  valid v0/v1 envelopes. The plan's request and safety screening remain an immutable generation
  snapshot rather than a competing editable profile.
- Kept the pinned dataset, 156-record generation allow-list, protected media pipeline, and
  central media resolver unchanged. Gym Visual binaries remain local/private only; conversational
  exercise cards may consume resolved media and attribution metadata but public production
  artifacts continue to use the non-protected fallback until the licensing gate is cleared.

Closing validation evidence for this refactor (2026-07-28, Node 22 wrapper):

- `npm run validate`: passed immutable Stitch references (11 files), UTF-8 (235 files), the
  1,324-record source dataset, 156 curated generation records, 1,324 media relationships,
  generated artifacts, typecheck, lint, 27 Vitest files/221 tests, Next production build, and
  the post-build media scan.
- `npm run test:e2e:all`: desktop/mobile Playwright passed 17 tests with 3 intentional skips;
  the disabled-media fixture passed separately (1 test). These cover chat-first generation,
  guided fallback, persistence, safety blocking, media attribution, responsive navigation,
  reduced motion, provider failure, and accessibility checks.
- `npm run test:cloudflare`: 2 files/11 tests passed. `npm run build:cloudflare` and
  `wrangler deploy --dry-run` passed with the AI binding, Granite model configuration, and
  production media disabled; `npm run validate:media` remained binary-free after packaging.
- Upgraded the configured local Ollama model to `qwen3:4b`, pulled it explicitly, and passed all
  7 real contract checks in three repetitions, including the reported two-turn profile/safety
  conversation. The safety schema now canonicalizes an unnecessary follow-up question on
  unsupported model output while preserving deterministic signals.
- Hardened latest-turn reconciliation so model fields without evidence in the current user message
  cannot overwrite the canonical profile. Profile acknowledgements before generation are now
  deterministic, commercial-gym defaults are not described as "sin equipo", and generation errors
  are rendered only once.
- The exact reported browser conversation passed on desktop and mobile with Mock AI and on desktop
  against the running local Ollama configuration; each run reached a validated four-day routine.
- Follow-up Ollama reproduction found a second failure mode: model-only `pain_during_movement`,
  `general_fitness`, and `gym_complete` labels on an ordinary profile turn. The reconciliation
  boundary now discards model-only safety labels, derives explicit goal/location values, and keeps
  only canonical equipment tokens.
- Added deterministic extraction for explicit profile facts in raw user turns, including
  location-only messages such as “Voy a entrenar en un gimnasio publico”; generic “equipamiento
  completo” no longer becomes a guessed equipment list.
- `npm audit --omit=dev --audit-level=high` reported zero production vulnerabilities. The full
  audit reports 13 high-severity development/build-chain advisories (ESLint and OpenNext
  minifier transitive paths), documented in `docs/KNOWN_LIMITATIONS.md` and
  `docs/SECURITY_REVIEW.md`.
