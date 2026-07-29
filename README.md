# FORMA

FORMA is a Spanish-language, chat-first workout planner backed by a deterministic, testable
routine engine. The primary creation workspace is `/crear/chat`: a user can describe a routine,
answer follow-up questions, receive the validated plan inline, ask grounded questions, and request
bounded changes without leaving the conversation. `/crear/manual` provides the same profile and
routine-generation path with no AI dependency.

The product includes:

- A conversational creation workspace with an editable structured-profile view and inline routine
  preview.
- A seven-step guided builder that works when every AI provider is disabled or unavailable.
- Ollama for local conversational development, Cloudflare Workers AI for production, and Mock and
  Disabled providers for deterministic tests and fallback behavior.
- A pinned, offline exercise catalog with search, filters, Spanish instructions, attribution, and
  156 implementation-reviewed exercises approved for generation.
- Deterministic one-to-six-day routine generation, volume/time validation, substitutions,
  prescription editing, reordering, one-day regeneration, and explainable selections.
- One versioned browser aggregate for messages, the editable request draft, safety state, current
  routine, provider/retry state, and migration from earlier persisted formats.
- Grounded exercise answers based only on the validated plan and local catalog, including real
  private-development media metadata and visible attribution.
- Controlled local/private use of the source JPG/GIF media, with a production exclusion gate until
  Gym Visual permission or compatible replacement licensing is confirmed.
- Next.js 16 production packaging for Cloudflare Workers through OpenNext.

## Trust boundary

```text
latest user message
        ↓
strict latest-turn delta (intent + patch + declared safety signals)
        ↓
deterministic merge into canonical v2 state
        ↓
derived missing fields + completion + authoritative safety
        ↓
validated RoutineRequest
        ↓
deterministic engine + pinned approved catalog + routine validator
        ↓
validated routine stored and shown inline
        ↓
bounded assistant wording over validated context
```

AI output is hostile input. Every structured response has size limits, a deadline, one repair
attempt, and strict Zod validation. The model does not report authoritative completeness, select
exercises, decide safety, or validate a plan. The complete catalog is never sent to a provider.
Assistant prose is limited to 1,500 characters and can only verbalize a bounded projection of
canonical and locally validated facts; deterministic Spanish copy remains available if response
composition fails.

## Requirements

- Node.js `>=22.13.0`
- npm
- Optional: Ollama for local chat
- Optional: a Cloudflare account for live Workers AI inference and deployment
- Optional: the pinned source checkout for private media import

The repository does not add authentication, a database, paid storage, or a runtime catalog network
dependency.

## Start locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. `/crear` redirects to the primary `/crear/chat` workspace. The
conversation keeps the structured profile and validated routine visible and saved locally. Use
`/crear/manual` at any time to complete or correct the same canonical profile without AI.

Copy `.env.example` to `.env.local` and change only the providers/features you intend to use. Do
not prefix provider credentials, model names, or Ollama configuration with `NEXT_PUBLIC_`.

### Complete product without AI

```env
AI_PROVIDER=disabled
EXERCISE_MEDIA_MODE=disabled
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=false
```

Open `/crear/manual`. Routine generation, validation, editing, exercise search, saving, and local
persistence remain available. If a provider fails during chat, FORMA preserves the conversation
and draft and links to this same guided path.

### Local Ollama chat

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:4b
AI_TIMEOUT_MS=60000
```

Ollama has a 60-second local default; hosted Cloudflare calls keep the 12-second production
default. See [`docs/LOCAL_AI_SETUP.md`](docs/LOCAL_AI_SETUP.md) for installation, real contract
evidence, model-specific commands, and failure behavior.

### Private local source media

The ignored `.local-media/` directory is the only allowed destination for the protected source
JPG/GIF files:

```bash
npm run data:fetch
npm run data:import -- --source .local-media/source-repo
npm run media:import -- --source .local-media/source-repo
npm run data:build
npm run validate:media -- --require-local
```

Then use:

```env
EXERCISE_MEDIA_MODE=local_private
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=true
EXERCISE_MEDIA_LOCAL_ROOT=.local-media/exercises-dataset
NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA=false
```

This mode is rejected in production. Media attribution and licensing status remain visible even
when a protected binary cannot be published. See [`docs/MEDIA_IMPORT.md`](docs/MEDIA_IMPORT.md)
and [`docs/MEDIA_LICENSE_REVIEW.md`](docs/MEDIA_LICENSE_REVIEW.md).

## Validation

The primary offline gate is:

```bash
npm run validate
```

It validates the immutable Stitch reference, UTF-8, source dataset, curation, generated artifacts,
media boundaries, TypeScript, lint, unit/integration/property tests, the production Next.js build,
and a post-build media-leak scan.

Browser flows:

```bash
npm run test:e2e:all
```

Optional provider checks remain outside standard validation because they require local software
or account-backed inference:

```bash
npm run test:ollama
npm run test:cloudflare
```

The local default is now `qwen3:4b`, which passed the recorded 7/7 real contract checks. The smaller
`qwen3:1.7b` model previously passed the same contract checks. The simulated Cloudflare suite
passed 11/11 tests without spending inference;
the live account-backed Granite check remains manual. Details and exact commands are in the local
and Cloudflare setup documents.

## Dataset and curation

The source is `hasaneyldrm/exercises-dataset` at commit
`7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. Source records are immutable. Generated
normalization and application curation live in separate directories:

```text
src/data/source/       pinned upstream snapshot and notices
src/data/generated/    reproducible catalogs, indexes, manifests, and audit data
src/data/curated/      aliases, reviewed metadata, names, exclusions, replacements
```

The current audit contains 1,324 source exercises, 156 approved records, 35 explicit exclusions,
1,133 unreviewed explorer-only records, and 24 approved substitution groups. Review evidence is
in [`docs/DATASET_AUDIT.md`](docs/DATASET_AUDIT.md) and
[`docs/CURATION_REVIEW.md`](docs/CURATION_REVIEW.md).

## Architecture map

```text
src/ai/             bounded provider contracts, prompts, schemas, adapters, limits
src/application/    conversation orchestration and routine/exercise use cases
src/domain/         pure profile, safety, exercise, and routine rules
src/data/           source/generated/curated catalog layers and local search
src/media/          central resolver and private local delivery boundary
src/persistence/    canonical v2 conversation aggregate and migrations
src/components/     interactive presentation only
src/app/            App Router pages and server API composition
```

Design evidence under `docs/design-reference/` is immutable and independently checksum-validated;
it is never used as mutable runtime content. The chat-first workspace preserves the Stitch-derived
visual tokens, hierarchy, responsive patterns, and accessibility priorities.

## Cloudflare

```bash
npm run build:cloudflare
npm run deploy:cloudflare
```

The OpenNext package and Wrangler dry-run are automated validation targets, but deployment still
requires manual Cloudflare login/onboarding and a real Workers AI contract check. Protected Gym
Visual binaries must remain absent from `.open-next`. Follow
[`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) and the explicit launch gates in
[`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md).

## Safety and legal scope

FORMA is an educational strength-planning tool, not a medical, diagnostic, rehabilitation, or
postoperative service. Raw user text is screened deterministically; model signals can only make a
decision more conservative. Sensitive requests are blocked and progress is preserved. Review
`/privacidad` for local-data behavior and `/atribuciones` for data/media origins.

The dataset notices are preserved, but the repository's MIT license must not be interpreted as
permission to publish Gym Visual media. Public or commercial media permission and qualified
fitness, native-Spanish, and legal review remain human launch requirements.
