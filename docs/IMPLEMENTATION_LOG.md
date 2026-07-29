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

## 2026-07-29 — First account-backed Cloudflare deployment

Objective: publish the existing production package to the authenticated Cloudflare account and
verify the real Workers AI path without weakening the provider contract, deterministic safety,
or the protected-media launch boundary.

Invariants for this deployment:

- Granite remains an untrusted latest-turn parser behind the server-only `AI` binding; Zod and
  deterministic application/domain validation remain authoritative.
- No Cloudflare credential, account identifier, prompt, or raw model response is exposed to the
  browser or committed configuration.
- Protected Gym Visual binaries remain excluded from the public package and production media
  flags remain disabled.
- The guided form and deterministic routine engine remain usable if Workers AI fails or reaches
  quota.

Deployment and live evidence:

- Registered the account's first `workers.dev` subdomain and deployed Worker `forma-routines` to
  `https://forma-routines.fran40v.workers.dev` with the `AI` and `ASSETS` bindings.
- `npm run build:cloudflare` passed and `npm run validate:media` validated 1,324 media
  relationships while confirming the deployed package remained protected-binary-free.
- The first live Granite call exposed an adapter defect: Workers AI returned valid forced tool
  arguments inside the OpenAI-compatible `choices[].message.tool_calls` envelope, while the
  adapter only read root-level calls. The provider now accepts both documented envelopes, prefers
  tool arguments over message content, supports structured content envelopes, and still submits
  the extracted payload to the unchanged strict schema and one-repair boundary.
- A live comparison probe did not select Qwen3 30B: the candidate consumed the bounded response
  reasoning without issuing the forced call, while Granite issued valid arguments. Production
  therefore retains the GOAL-specified Granite model.
- The combined profile/all-clear sentence also exposed an overly broad safety contradiction
  check: `tengo un gimnasio` was treated like a medical contradiction. The detector now scopes
  affirmative contradictions to safety terms while retaining fail-closed handling for actual
  pain, injury, operation, restriction, symptom, or professional-instruction statements. A broad
  all-clear can no longer suppress independently unsupported pregnancy-specific, minor, or
  complex-medical-condition requests, and direct `No siento dolor...` phrasing is recognized as
  negation rather than pain.
- Provider contract tests pass 15/15; focused conversation/domain safety tests pass 40/40;
  typecheck and lint pass for the changed boundaries.
- Post-deploy HTTP checks returned 200 for the landing page, chat, explorer, saved routines, and
  attribution page. The off-topic API returned `off_topic`, and the complete UTF-8 profile turn
  returned the expected goal, experience, three days, 60 minutes, commercial gym, and explicit
  no-limitations confirmation.
- A headless Chromium smoke test against the public URL reached 100% profile completion and a
  validated inline `Hipertrofia · 3 días` routine without browser console errors.
- The final deployed version `0adf2829-0b19-4ea4-98bd-44c01c8d0e0b` repeated that browser smoke
  test and returned deterministic `pregnancy_specific` blocking in three consecutive public API
  checks after edge propagation.
- Final `npm run validate` passed 11 immutable Stitch references, UTF-8 validation across 239
  text files, the 1,324-record source/generated/media boundaries, 156 approved generation
  records, typecheck, zero-warning lint, 29 Vitest files/250 tests, the Next production build,
  and the post-build protected-media scan.

This is deployment and smoke-test evidence, not final public-launch approval. Workers/Workers AI
quota and billing acceptance, repeated account-backed testing of every semantic operation,
quota-exhaustion behavior, legal/privacy review, native-language review, professional programming
review, and the Gym Visual licensing decision remain explicit launch gates.

## 2026-07-29 — Owner-authorized media bundle and hostname migration

Objective: replace production placeholders with the repository's exact pinned exercise media and
move the Worker toward `app.forma-gym.workers.dev`, following the repository owner's explicit
override while keeping attribution and unresolved licensing status visible.

- Added `owner_authorized_source` as a production-only opt-in distinct from the development
  `local_private` mode and separately licensed replacements.
- Added a deterministic staging step that validates and copies exactly 1,324 JPG plus 1,324 GIF
  files (137,616,454 bytes) from ignored local storage into the isolated OpenNext static namespace.
- Tightened the artifact scanner to accept protected bytes only at manifest-derived paths with
  matching SHA-256 hashes and an explicit validation flag, and to reject partial bundles, extra
  files, modified notices, renamed copies or leaks elsewhere. The standard validator remains
  fail-closed.
- Kept `wrangler.jsonc` and the ordinary Cloudflare lifecycle media-disabled. The separate
  `wrangler.authorized-media.jsonc` and `*:cloudflare:authorized-media` commands require a named
  opt-in, validate destination bytes immediately before upload, and clean local staging after
  deploy. This path requires the ignored local import and is not Git/Cloudflare-CI deployable.
- Wrapped the default Cloudflare lifecycle as well: it forcibly overrides stale shell/`.env`
  media flags to `disabled`, removes only the exact staging namespace, builds with the default
  config and runs the fail-closed scanner. A hostile preflight with source-media environment
  values still produced a 45-asset binary-free dry-run with disabled runtime bindings.
- Configured the target Worker name as `app`, disabled preview URLs, retained Workers AI and
  deterministic fallback configuration, and recorded that a hostname change does not migrate
  browser-local routines or conversations.
- Preserved original media attribution and watermarks. Public/commercial permission is still
  recorded as pending; the owner's limited-use decision is not represented as legal clearance.
- Deployed Worker `app`; final verified version `36a2799e-9de6-4962-b5b3-c3d1513d9cab`. Live JPG and GIF
  responses matched pinned hashes, exercise/chat HTML referenced the source-media namespace and
  retained attribution, and static responses gained immutable caching plus `nosniff`.
- `forma-gym` passed the account-subdomain availability preflight, but Cloudflare rejected the
  public API update with code `10036` because an existing subdomain can be changed only through
  the dashboard flow. Production therefore remains temporarily at
  `https://app.fran40v.workers.dev`; the final manual dashboard action is recorded rather than
  attempting a destructive delete/re-register workaround.

## 2026-07-29 — Message, duration and portable-routine UX hardening

Objective: make long chat input understandable, treat requested session time as a real planning
target, expose exercise demonstrations without leaving the routine, and let a person take a
portable text copy of the validated plan through the phone's native share surface.

Invariants for this phase:

- User text is never silently truncated. Client, server and persisted-message character limits
  stay aligned, and the additional word limit is enforced before any provider call.
- Duration parsing and fitting remain deterministic. No provider chooses exercises, volume,
  timing or validity, and time is never filled by weakening safety, equipment or volume limits.
- Routine export contains structured text and exercise-detail links only; protected JPG/GIF
  binaries are not packaged or redistributed through the export action.
- Animated demonstrations are user-triggered, load at most one GIF per routine surface, preserve
  attribution and dimensions, and retain the exercise detail route as a separate action.
- `docs/design-reference/**`, source dataset records and imported media remain unchanged.

Implemented boundaries:

- The chat now shows a 600-word and 4,000-character budget, preserves over-limit drafts, prevents
  only submission, grows with content and visually hides its internal scrollbar.
- Spanish duration parsing normalizes `90 min`, `noventa minutos`, `1 h 30`, decimal hours and
  `una hora y media` before the AI result reaches domain state.
- Engine `1.1.0` estimates active repetitions, configured recovery, equipment transitions and
  explicit mobility/preparation/closure blocks. It fits safe work first, then assigns any remaining
  target difference to those visible low-fatigue blocks without increasing effective-set volume.
- The full real-catalog matrix now asserts both successful validation and duration tolerance for
  every goal, experience, 1–6 day frequency and 30/45/60/75/90/120-minute guided value. The
  reported four-day intermediate hypertrophy profile produces four 90-minute days, and a
  conversational 60→90 minute change forces complete regeneration.
- Routine cards toggle one inline JPG/GIF demonstration at a time while preserving `Ver ficha`,
  source attribution and the protected-media boundary.
- `Exportar al teléfono` prefers native Web Share with a local UTF-8 `.txt` file, falls back to
  text sharing and then browser download. The export includes prescriptions, session blocks,
  exercise-detail links and attribution, but never media binaries.

Validation evidence prepared for release:

- `npm run validate` covers the 11 immutable Stitch files, UTF-8, all 1,324 source/media
  relationships, 156 approved generation records, TypeScript, zero-warning lint, the complete
  Vitest suite and the production Next build.
- The real-catalog duration matrix covers 432 request combinations and now rejects any generated
  day outside the shared target band. A separate regression rejects a materially short new plan
  even when its stored duration matches its visible blocks.
- `npm run test:e2e:all` covers desktop/mobile long input, native-share fallback, inline JPG/GIF
  toggling without navigation, guided generation/edit/save, Mock conversation behavior,
  accessibility, reduced motion, local protected media and the isolated disabled-media build.
- Manual screenshots at 1,440 px and 390 px widths confirmed the growing composer, visible count,
  responsive routine actions and explicit session blocks without changing Stitch references.

## 2026-07-29 — Visual PDF routine export

Objective: replace the text-only primary export with a useful, phone-friendly document that
preserves the validated routine structure, technique instructions and visible media attribution.

- Added a browser-only `@react-pdf/renderer` flow loaded dynamically after `Exportar PDF`; PDF
  rendering and image work do not run in the Cloudflare Worker or delay the initial routine UI.
- Extended the deterministic catalog build with `routine-export-details.json`, a 101-KB artifact
  containing Spanish instruction steps for the 156 generation-approved exercises. The exporter
  selects only IDs present in the plan and never loads/parses the 3.2-MB detail catalog.
- Added a pure PDF DTO that combines the validated plan, curated catalog, resolved media and
  instruction subset without introducing AI or vendor dependencies into domain logic.
- Added an A4 document with a FORMA cover, weekly index, bookmarks, one section per day, visible
  preparation/closure blocks and exercise cards containing JPG, prescription, RIR/RPE, reasons,
  notes, complete Spanish steps and a clickable detail/demonstration link.
- Added a final warnings, assumptions, sources, attribution and pending-license section. Static
  thumbnails keep their original bytes and watermark; GIFs are not embedded and source media is
  not exposed as a standalone download.
- Retired the earlier TXT action after product review so the portable flow exposes one complete,
  unambiguous format. PDF preparation and native sharing are separate actions so the eventual
  `Compartir PDF` click retains a fresh mobile user gesture; `Guardar PDF` remains the universal
  fallback.
- Extended the repository owner's limited personal-use media authorization specifically to
  contextual JPG thumbnails in personal routine PDFs. This is still not represented as Gym
  Visual permission or public/commercial license clearance.
- Added pure-model, generated-detail, image-fetch/fallback, PDF binary, native share/download and
  browser E2E assertions. Disabled media still produces a valid PDF with designed placeholders.
- `docs/design-reference/**`, source records and imported JPG/GIF binaries remain unchanged.
