# Cloudflare Workers deployment

FORMA is packaged for Cloudflare Workers with `@opennextjs/cloudflare`. The checked-in
`wrangler.jsonc` declares the server-side `AI` binding, configures
`@cf/ibm-granite/granite-4.0-h-micro` in forced function-calling mode, and fails closed with media
disabled. The separate `wrangler.authorized-media.jsonc` is used only by the explicitly named
owner-authorized deployment command. No account ID, token, credential, binding object, or provider
configuration belongs in a `NEXT_PUBLIC_` variable.

The production provider interprets only the latest conversational turn and optionally phrases a
bounded response. Deterministic application/domain code owns canonical merge, completeness,
safety, routine generation, catalog grounding, and final validation. The complete product remains
available through `/crear/manual` if the binding, model, quota, or provider is unavailable.

## What is already automated

- Next.js 16 production build and OpenNext adaptation.
- Workers AI binding declaration and server-only binding lookup.
- Strict latest-turn, response-composition, modification, safety, and explanation schemas with one
  repair attempt, input/output limits, abort propagation, and typed failures.
- A 12-second Cloudflare provider deadline and 1,500-character assistant/explanation bound.
- Best-effort per-isolate endpoint burst limiting plus provider quota/rate error mapping.
- Canonical v2 browser persistence and a guided no-AI route independent of Cloudflare.
- Pinned source-media staging with exact filename/size/hash validation and an isolated static
  namespace; attribution and the pending licensing status remain visible.
- Simulated Workers AI binding contract tests that consume no inference.

FORMA does not configure R2, D1, KV, authentication, a server routine store, or a paid cache.
Browser routines remain local and the catalog is bundled read-only.

## Recorded automated evidence — 2026-07-28

- `npm run test:cloudflare`: 11/11 simulated binding/contract tests passed without account-backed
  inference.
- `npm run build:cloudflare`: the OpenNext package built successfully.
- `npx wrangler deploy --dry-run`: Wrangler accepted and packaged the deployment without uploading
  it.
- `npm run validate:media`: the package scan found zero protected Gym Visual binaries in the
  production artifacts.

These checks prove adapter/package behavior, not target-account authorization, live Granite
structured-output reliability, current quota, or successful deployment. Those gates remain
manual for the 2026-07-28 evidence above.

## Live deployment evidence — 2026-07-29

- Worker: `forma-routines`.
- Public URL: `https://forma-routines.fran40v.workers.dev`.
- Verified deployment version: `0adf2829-0b19-4ea4-98bd-44c01c8d0e0b`.
- Bindings confirmed by Wrangler: server-only Workers AI `AI` and static `ASSETS`.
- Production model/mode: `@cf/ibm-granite/granite-4.0-h-micro` with forced function calling.
- Production media: disabled; the exact OpenNext package passed the 1,324-relationship scan and
  contained no protected Gym Visual binaries.
- Live pages returned 200 for `/`, `/crear/chat`, `/ejercicios`, `/guardadas`, and
  `/atribuciones`.
- Live API checks passed deterministic `off_topic` handling and a complete UTF-8 profile turn.
- Headless Chromium reached a 100% profile and a validated three-day inline routine without
  console errors.

The initial live model response revealed that Workers AI used an OpenAI-compatible
`choices[].message.tool_calls` envelope. The provider now normalizes that known transport shape
before the existing strict schema boundary; it does not accept partial data or arbitrary nested
JSON. The same deployment also narrowed safety-contradiction recognition so the equipment phrase
`tengo un gimnasio` cannot invalidate an otherwise explicit all-clear.

This evidence clears first deployment and smoke testing only. Repeated checks for every semantic
operation, quota exhaustion, account usage/billing acceptance, and the non-Cloudflare legal,
professional, language, accessibility, and media-license gates remain open.

## Owner-authorized media deployment — 2026-07-29

- Worker: `app`.
- Current verified URL: `https://app.fran40v.workers.dev`.
- Target URL after the account-dashboard rename: `https://app.forma-gym.workers.dev`.
- Verified deployment version: `36a2799e-9de6-4962-b5b3-c3d1513d9cab`.
- The explicit authorized lifecycle validated and uploaded 1,324 JPG plus 1,324 GIF files
  (137,616,454 bytes) from the pinned dataset and removed local staging afterward.
- Live checks returned exact manifest SHA-256 values for JPG and GIF responses, correct MIME types,
  real-media URLs in exercise/chat HTML, visible `gymvisual.com` attribution, immutable one-year
  browser caching and `X-Content-Type-Options: nosniff`.
- The ordinary `wrangler.jsonc`, validator and Cloudflare lifecycle remain media-disabled and
  binary-free. Only the separate authorized config/command can package this bundle.
- Cloudflare's public account-subdomain API returned code `10036` because the account already has
  `fran40v`; current Cloudflare documentation requires changing an existing value in Dashboard →
  Workers & Pages → **Change** next to **Your subdomain**. The preflight reported `forma-gym`
  available, but it is not reserved until that dashboard action is completed.
- The previous `forma-routines` Worker is intentionally retained until the final hostname is
  verified. Browser-local routines/conversations do not migrate between the old and new origins.

The package pins the OpenNext build-only `@node-minify/core` dependency to compatible v8.0.6. The
pin is not application runtime logic and must be retained until the upstream OpenNext dependency
range makes it unnecessary. The same recorded validation run reported zero production dependency
vulnerabilities with `npm audit --omit=dev`; the full audit's ESLint and OpenNext build-chain
advisories are development/packaging-only context retained in
[`SECURITY_REVIEW.md`](SECURITY_REVIEW.md).

## Manual prerequisites

1. Use Node.js `>=22.13.0`.
2. Create or select the intended Cloudflare account.
3. Review current Workers and Workers AI quotas, pricing, data handling, and terms for that account.
4. Complete Workers onboarding, including a `workers.dev` subdomain when requested.
5. Review `wrangler.jsonc`, especially Worker name, compatibility date/flags, binding, model,
   12-second timeout, and media flags.
6. Review the explicit `owner_authorized_source` exception and the still-pending Gym Visual
   licensing gate before using this configuration for any audience beyond the recorded limited
   personal deployment.

Local Wrangler preview using Workers AI can consume the target account's allocation. Pricing and
limits change; verify the current
[official Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
before public launch. FORMA does not opt an account into a paid plan.

## Install and validate

Wrangler is already a development dependency. The explicit setup command required by the project
for a fresh environment remains:

```bash
npm install --save-dev wrangler@latest
npm ci
npm run validate
npm run test:cloudflare
npm run build:cloudflare
npx wrangler deploy --dry-run
npm run validate:media
```

`test:cloudflare` is simulated. The commands above build the fail-closed, binary-free package.
The owner-authorized package is a separate local-only path:

```bash
npm run build:cloudflare:authorized-media
npm run validate:media:authorized
```

That explicit build requires `.local-media/exercises-dataset`, which is ignored by Git and is not
available in a clean GitHub/Cloudflare checkout. It validates and stages exactly 2,648 pinned
assets under `/exercises/source-media/`. The authorized scanner rejects modified, incomplete,
renamed, extra or out-of-namespace files and validates the deployment notice. The default scanner
rejects any staged source-media bundle unless the explicit authorization flag is present.

## Authenticate

This opens a browser and cannot be completed by an automated coding agent:

```bash
npx wrangler login
npx wrangler whoami
```

If the account has not deployed a Worker before, complete onboarding in the Cloudflare dashboard.
A missing `workers.dev` subdomain can block preview/deploy even when local packaging and credentials
are otherwise correct.

## Current interpretation API contract

`POST /api/ai/interpret` does not ask Granite to return application state. The provider interprets
the latest message; canonical state stays in deterministic application/persistence code:

```powershell
$body = @{
  message = "Soy intermedio. Quiero hipertrofia cuatro días, 60 minutos, en gimnasio con mancuernas y máquinas. No tengo dolor, lesiones, síntomas ni restricciones."
  currentLimitationsConfirmation = "not_confirmed"
  locale = "es-AR"
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/ai/interpret `
  -ContentType "application/json" -Body $body
```

A successful response has this shape (the exact patch values follow the user's latest message):

```json
{
  "ok": true,
  "turn": {
    "intent": "provide_information",
    "requestPatch": {
      "goal": "hypertrophy",
      "experience": "intermediate",
      "daysPerWeek": 4,
      "sessionMinutes": 60,
      "trainingLocation": "commercial_gym",
      "availableEquipment": ["dumbbell", "machine"]
    },
    "limitationsConfirmation": "no_limitations",
    "safetySignals": [],
    "assumptions": []
  }
}
```

The `turn` object deliberately has no `missingFields`, `completionPercentage`, `status`, final
safety decision, or routine. The application validates it, re-runs raw-text safety detection,
merges the patch into canonical v2 state, derives completeness, and invokes the deterministic
engine only when the resulting request is complete and safe.

Provider/model diagnostics are development-only. Do not expect `provider` or `model` identifiers
in a production response and do not add them merely to verify deployment; use Wrangler logs and
the Cloudflare dashboard for operational evidence.

## Account-backed Granite check

The simulated 11/11 result does not execute Granite. After authentication, build and start an
OpenNext preview connected to the intended account:

```bash
npm run preview:cloudflare
```

Then exercise the displayed preview URL through `/crear/chat` and the bounded APIs. Repeat the seven
semantic behaviors used by the provider contract:

1. A complete request returns a valid latest-turn delta and the deterministic engine shows a
   validated routine inline.
2. An incomplete request produces only the delta; application code derives the actual missing
   fields and asks at most two focused questions.
3. A safety-only follow-up preserves every explicit profile field from the preceding turn and can
   complete deterministic generation.
4. A greeting produces a natural bounded response without modifying the profile.
5. A change names an existing placement and deterministic modification code applies and validates
   it without regenerating unaffected days.
6. Recent-injury text remains blocked by deterministic safety even if provider output is less
   conservative.
7. Routine/exercise questions contain only validated plan/catalog facts and visible media
   attribution.

Also verify response-composition fallback, quota/rate/binding errors, preserved conversation state,
the `/crear/manual` continuation, and expected bounded usage in the dashboard. Record account,
model ID, structured mode, date, repetitions, and any failures in `docs/DECISIONS.md` and
`docs/KNOWN_LIMITATIONS.md` without copying private prompts or raw model output.

If Granite fails the repeated live contract, do not loosen Zod, accept partial output, expose
diagnostics in production, or silently switch models. Test a currently supported smaller
function-calling model against the identical contract, record the evidence, and only then change
`CLOUDFLARE_AI_MODEL` or configure `CLOUDFLARE_AI_FALLBACK_MODEL`.

## Deploy

The repository's default, binary-free OpenNext lifecycle command is:

```bash
npm run deploy:cloudflare
```

The repository-owner exception must use the visibly distinct local command:

```bash
npm run deploy:cloudflare:authorized-media
```

This command requires the exact `--authorize-owner-source-media` gate internally, uses
`wrangler.authorized-media.jsonc`, validates source and staged bytes immediately before upload,
and removes the local staged bundle after a successful or failed deployment attempt. The ordinary
build/deploy config remains disabled and cannot opt in through a stale `.env` value.

The underlying Wrangler command requested by the project is also available after packaging:

```bash
npm run build:cloudflare
npx wrangler deploy
```

Do not use multiple deployment commands for the same release. Each lifecycle command includes its
own OpenNext build; direct Wrangler deployment expects a matching already-built `.open-next`
package and matching Wrangler config.

## Post-deploy smoke test

1. Open `/`, `/crear`, `/crear/chat`, `/crear/manual`, `/ejercicios`, `/rutina`, `/guardadas`,
   `/atribuciones`, and `/privacidad` on mobile and desktop.
2. Complete a multi-turn chat, verify structured-profile updates, and generate a routine inline.
3. Modify one existing exercise and ask grounded routine/exercise questions.
4. Reload and verify the canonical conversation/profile/current routine are restored.
5. Disable or exhaust AI and generate/edit the same product through `/crear/manual` without losing
   the draft.
6. Confirm provider/model identifiers are absent from normal production UI and responses.
7. For a default deploy, confirm the neutral placeholder. For the owner-authorized deploy, confirm
   JPG/GIF responses match pinned hashes and visible Gym Visual attribution remains present.
8. Run `npm run validate:media` for the default package or
   `npm run validate:media:authorized` for the exact authorized package before upload and retain
   the result as release evidence.
9. Review Workers AI usage, quota behavior, alerts, and runtime logs in the target account.

For a new account, account creation and browser authorization remain explicit operator actions.
For the currently recorded account, onboarding, first deployment, and a live Granite smoke test
are complete; quota/terms acceptance and final release approval remain operator actions. Do not
mark public release ready until every remaining gate is recorded in
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).
