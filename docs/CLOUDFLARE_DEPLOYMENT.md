# Cloudflare Workers deployment

FORMA is packaged for Cloudflare Workers with `@opennextjs/cloudflare`. The checked-in
`wrangler.jsonc` declares the server-side `AI` binding and configures
`@cf/ibm-granite/granite-4.0-h-micro` in forced function-calling mode. No account ID, token,
credential, binding object, or provider configuration belongs in a `NEXT_PUBLIC_` variable.

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
- Production exclusion and post-build scanning of protected Gym Visual binaries.
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
manual.

The package pins the OpenNext build-only `@node-minify/core` dependency to compatible v8.0.6. The
pin is not application runtime logic and must be retained until the upstream OpenNext dependency
range makes it unnecessary. The same recorded validation run reported zero production dependency
vulnerabilities with `npm audit --omit=dev`; detailed development-tool advisory context remains in
[`SECURITY_REVIEW.md`](SECURITY_REVIEW.md).

## Manual prerequisites

1. Use Node.js `>=22.13.0`.
2. Create or select the intended Cloudflare account.
3. Review current Workers and Workers AI quotas, pricing, data handling, and terms for that account.
4. Complete Workers onboarding, including a `workers.dev` subdomain when requested.
5. Review `wrangler.jsonc`, especially Worker name, compatibility date/flags, binding, model,
   12-second timeout, and media flags.
6. Keep `EXERCISE_MEDIA_MODE=disabled` until the separate Gym Visual launch gate is cleared.

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

`test:cloudflare` is simulated. `build:cloudflare` creates `.open-next/`; always run the media scan
after packaging so protected source bytes cannot enter the upload.

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

Then exercise the displayed preview URL through `/crear/chat` and the bounded APIs. Repeat the six
semantic behaviors used by the provider contract:

1. A complete request returns a valid latest-turn delta and the deterministic engine shows a
   validated routine inline.
2. An incomplete request produces only the delta; application code derives the actual missing
   fields and asks at most two focused questions.
3. A greeting produces a natural bounded response without modifying the profile.
4. A change names an existing placement and deterministic modification code applies and validates
   it without regenerating unaffected days.
5. Recent-injury text remains blocked by deterministic safety even if provider output is less
   conservative.
6. Routine/exercise questions contain only validated plan/catalog facts and visible media
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

The repository's default OpenNext lifecycle command is:

```bash
npm run deploy:cloudflare
```

The underlying Wrangler command requested by the project is also available after packaging:

```bash
npm run build:cloudflare
npx wrangler deploy
```

Do not use both deployment commands for the same release. `deploy:cloudflare` includes the
OpenNext packaging lifecycle; direct Wrangler deployment expects the already-built `.open-next`
package.

## Post-deploy smoke test

1. Open `/`, `/crear`, `/crear/chat`, `/crear/manual`, `/ejercicios`, `/rutina`, `/guardadas`,
   `/atribuciones`, and `/privacidad` on mobile and desktop.
2. Complete a multi-turn chat, verify structured-profile updates, and generate a routine inline.
3. Modify one existing exercise and ask grounded routine/exercise questions.
4. Reload and verify the canonical conversation/profile/current routine are restored.
5. Disable or exhaust AI and generate/edit the same product through `/crear/manual` without losing
   the draft.
6. Confirm provider/model identifiers are absent from normal production UI and responses.
7. Confirm exercise media uses the neutral production placeholder while attribution/licensing
   status stays visible.
8. Run `npm run validate:media` against the exact `.open-next` package before upload and retain the
   zero-protected-binaries result as release evidence.
9. Review Workers AI usage, quota behavior, alerts, and runtime logs in the target account.

Account creation, browser authorization, live Granite inference, quota/terms review, and final
deployment remain explicit operator actions. Do not mark public release ready until they are
recorded in [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).
