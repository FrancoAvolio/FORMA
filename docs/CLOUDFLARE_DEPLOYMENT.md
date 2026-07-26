# Cloudflare Workers deployment

FORMA is packaged for Cloudflare Workers with `@opennextjs/cloudflare`. The checked-in
`wrangler.jsonc` declares the server-side `AI` binding and uses
`@cf/ibm-granite/granite-4.0-h-micro` in forced function-calling mode. No account ID, token, or
credential belongs in the repository or in a `NEXT_PUBLIC_` variable.

## What is already automated

- Next.js 16 production build and OpenNext adaptation.
- Workers AI binding declaration.
- Provider selection and server-only binding lookup.
- Strict structured-output contract, one repair, timeouts, size limits, rate/quota errors, and
  guided-form fallback.
- Best-effort per-isolate endpoint burst limiting plus provider quota handling.
- Production exclusion and post-build scanning of protected Gym Visual binaries.
- Simulated binding contract tests that consume no inference.

FORMA does not configure R2, a database, authentication, or a paid cache. Browser routines stay
local and the catalog is bundled read-only.

## Manual prerequisites

1. Use Node.js `>=22.13.0`.
2. Create or select the intended Cloudflare account.
3. Review current Workers and Workers AI quotas/terms for that account.
4. Complete Workers onboarding, including a `workers.dev` subdomain when Cloudflare requests it.
5. Review `wrangler.jsonc`, especially the Worker name, compatibility date, model, and media
   flags.
6. Keep `EXERCISE_MEDIA_MODE=disabled` until the separate Gym Visual launch gate is cleared.

Workers AI currently has a free daily allocation, but inference in local Wrangler development
also uses the account and can consume that allocation. Limits and pricing change; verify the
current [official Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
before every public launch. FORMA does not opt an account into a paid Workers plan.

## Install and validate

Wrangler is already a development dependency. The explicit setup command required for a fresh
environment is:

```bash
npm install --save-dev wrangler@latest
npm ci
npm run validate
npm run test:cloudflare
npm run build:cloudflare
```

`test:cloudflare` uses a simulated binding. `build:cloudflare` creates `.open-next/` and must be
followed by `npm run validate:media` so protected source bytes cannot enter the package.

## Authenticate

This step opens a browser and cannot be completed by an automated coding agent:

```bash
npx wrangler login
npx wrangler whoami
```

If the account has not deployed a Worker before, complete the onboarding prompt in the
Cloudflare dashboard. A missing `workers.dev` subdomain blocks preview/deploy even when local
code and credentials are otherwise correct.

## Account-backed model contract check

The configured model is documented by Cloudflare as supporting function calling, but the exact
FORMA schema must still pass in the target account/runtime. Build, start an OpenNext preview,
and send a complete request:

```bash
npm run preview:cloudflare
```

In a second terminal, POST to the displayed local preview URL:

```powershell
$body = @{
  message = "Quiero hipertrofia, soy intermedio, cuatro días, 60 minutos, en gimnasio con barra, mancuernas, poleas y máquinas. No tengo dolor ni restricciones."
  currentLimitationsConfirmation = "not_confirmed"
  locale = "es-AR"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri http://localhost:8787/api/ai/interpret `
  -ContentType "application/json" -Body $body
```

Confirm all of the following before deployment:

- Response provider is `cloudflare` and the configured Granite model.
- Result passes the complete schema and does not contain invented fields.
- A second incomplete request reports only the actual missing fields.
- Quota/rate/binding failures return the preserved-state guided-form UI.
- The Cloudflare dashboard records expected, bounded usage.

If Granite fails the repeated provider contract, do not loosen Zod or parse partial output.
Test a currently supported smaller function-calling model, record the evidence in
`docs/DECISIONS.md`, and only then change `CLOUDFLARE_AI_MODEL` or enable a fallback.

## Deploy

The OpenNext-recommended command is:

```bash
npm run deploy:cloudflare
```

The underlying Wrangler deployment command requested by the project specification is also
available after `npm run build:cloudflare`:

```bash
npx wrangler deploy
```

Do not use both for the same release. OpenNext's deploy command additionally handles its
packaging lifecycle and is the default for this repository.

## Post-deploy smoke test

1. Open `/`, `/crear`, `/ejercicios`, `/rutina`, `/guardadas`, `/atribuciones`, and
   `/privacidad` on mobile and desktop.
2. Generate through the guided form with AI unavailable.
3. Generate once through Cloudflare chat and inspect the structured provider state.
4. Force or simulate quota exhaustion and confirm the guided fallback retains the message.
5. Confirm exercise media is the neutral production placeholder.
6. Run `npm run validate:media` against the local `.open-next` package before upload and retain
   the validation log as release evidence.
7. Review Workers AI usage limits/alerts in the target account.

Account connection, browser authorization, real inference, quota review, and final deployment
remain explicit operator actions. Do not mark the public release ready until they are recorded
in `docs/PRODUCTION_READINESS.md`.

