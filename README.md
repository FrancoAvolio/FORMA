# FORMA

FORMA is a Spanish-language workout planner built around a deterministic, testable routine
engine. A guided form works without AI. The optional chat translates natural language into
the same validated `RoutineRequest`; it never selects exercises or bypasses safety and routine
validation.

The product includes:

- A seven-step guided routine builder that works fully offline after installation.
- Optional conversational interpretation through Ollama, Cloudflare Workers AI, Mock, or a
  disabled provider.
- A pinned, offline exercise catalog with search, filters, Spanish instructions, attribution,
  and 156 implementation-reviewed exercises approved for generation.
- Deterministic one-to-six-day routine generation, volume/time validation, substitutions,
  prescription editing, reordering, one-day regeneration, and explainable selections.
- Versioned browser persistence for setup state, conversations, active and saved routines,
  and media preferences.
- Controlled local/private use of the source JPG/GIF media, with a production exclusion gate
  until Gym Visual permission or licensing is confirmed.
- Next.js 16 production packaging for Cloudflare Workers through OpenNext.

## Trust boundary

```text
chat or guided form
        ↓
validated RoutineRequest
        ↓
deterministic engine + pinned approved catalog
        ↓
routine validator
        ↓
editable, locally persisted RoutinePlan
```

AI output is hostile input. Every structured response has size limits, a deadline, one repair
attempt, and strict Zod validation. The complete catalog is never sent to a model. Safety,
exercise existence, equipment compatibility, volume, duration, substitutions, and final
validity remain deterministic.

## Requirements

- Node.js `>=22.13.0`
- npm
- Optional: Ollama for local chat
- Optional: a Cloudflare account for Workers AI/deployment
- Optional: the pinned source checkout for private media import

The repository does not add authentication, a database, paid storage, or a runtime catalog
network dependency.

## Start locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. The default example configuration keeps AI and protected media
disabled, so the guided form, explorer, routine engine, and local persistence work immediately.

Copy `.env.example` to `.env.local` and change only the providers/features you intend to use.
Do not prefix provider credentials or Ollama configuration with `NEXT_PUBLIC_`.

### Guided form without AI

```env
AI_PROVIDER=disabled
EXERCISE_MEDIA_MODE=disabled
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=false
```

### Local Ollama chat

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

See [`docs/LOCAL_AI_SETUP.md`](docs/LOCAL_AI_SETUP.md) for installation, contract testing, and
failure behavior.

### Private local source media

The ignored `.local-media/` directory is the only allowed destination for the protected
source JPG/GIF files:

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

This mode is rejected in production. See [`docs/MEDIA_IMPORT.md`](docs/MEDIA_IMPORT.md) and
[`docs/MEDIA_LICENSE_REVIEW.md`](docs/MEDIA_LICENSE_REVIEW.md).

## Validation

The primary offline gate is:

```bash
npm run validate
```

It validates the immutable Stitch reference, source dataset, curation, generated artifacts,
media boundaries, TypeScript, lint, unit/integration/property tests, the production Next.js
build, and a post-build media-leak scan.

Browser flows:

```bash
npm run test:e2e
npm run test:e2e:disabled-media
```

Optional provider checks remain outside standard validation because they require local software
or account-backed inference:

```bash
npm run test:ollama
npm run test:cloudflare
```

`test:cloudflare` is the non-billing simulated binding contract. The account-backed probe and
deployment smoke test are documented in
[`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md).

## Dataset and curation

The source is `hasaneyldrm/exercises-dataset` at commit
`7455efae41b330c265e7cd4b78dfa848e7ce5ebd`. Source records are immutable. Generated
normalization and application curation live in separate directories:

```text
src/data/source/       pinned upstream snapshot and notices
src/data/generated/    reproducible catalogs, indexes, manifests, and audit data
src/data/curated/      aliases, reviewed metadata, names, exclusions, replacements
```

The current audit contains 1,324 source exercises, 156 approved records, 35 explicit
exclusions, 1,133 unreviewed explorer-only records, and no broken aliases or approved
substitution groups. Review evidence is in [`docs/DATASET_AUDIT.md`](docs/DATASET_AUDIT.md)
and [`docs/CURATION_REVIEW.md`](docs/CURATION_REVIEW.md).

## Architecture map

```text
src/ai/             provider contracts, prompts, schemas, adapters, limits
src/application/    routine and exercise use cases
src/domain/         pure profile, safety, exercise, and routine rules
src/data/           source/generated/curated catalog layers and search
src/media/          central resolver and private local delivery boundary
src/persistence/    versioned storage repository and migrations
src/components/     interactive presentation only
src/app/            App Router pages and server API composition
```

Design evidence under `docs/design-reference/` is immutable and independently checksum-
validated; it is never used as mutable runtime content.

## Cloudflare

```bash
npm run build:cloudflare
npm run deploy:cloudflare
```

Deployment requires manual Cloudflare login/onboarding and a real Workers AI contract check.
Protected Gym Visual binaries are absent from `.open-next`. Follow
[`docs/CLOUDFLARE_DEPLOYMENT.md`](docs/CLOUDFLARE_DEPLOYMENT.md) and the explicit launch gates in
[`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md).

## Safety and legal scope

FORMA is an educational strength-planning tool, not a medical, diagnostic, rehabilitation, or
postoperative service. Sensitive requests are blocked deterministically and user progress is
preserved. Review `/privacidad` for local-data behavior and `/atribuciones` for data/media
origins.

The dataset notices are preserved, but the repository's MIT license must not be interpreted as
permission to publish Gym Visual media. Public or commercial media permission and qualified
fitness/native-Spanish curation review remain human launch requirements.
