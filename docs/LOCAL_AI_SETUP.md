# Local AI setup (Ollama)

Ollama powers the local conversational layer; it is not required for the product's domain
features. `/crear/chat` is FORMA's primary creation workspace when a provider is available.
`/crear/manual` reads and writes the same canonical browser state and provides complete profile,
safety, deterministic generation, editing, search, and saving without Ollama.

## Manual prerequisites

Install Ollama from its official distribution for your operating system. This is a manual operator
action; the project does not install or start system software and never downloads a model
silently.

Download and start the configured local default:

```bash
ollama pull qwen3:1.7b
ollama run qwen3:1.7b
```

Keep Ollama running while using conversational interpretation. The model download can be
substantial and remains outside the repository.

## Environment

Add these server-only values to `.env.local`:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
AI_TIMEOUT_MS=60000
AI_DEBUG_LOGS=false
```

Do not prefix these variables with `NEXT_PUBLIC_`. The browser never calls port 11434. Next.js
routes obtain the provider from the server-only factory; only `OllamaAiProvider` knows the Ollama
protocol.

`OLLAMA_BASE_URL` must be an HTTP(S) URL. `AI_TIMEOUT_MS` accepts 1,000–60,000 milliseconds.
Ollama's default is 60 seconds to accommodate local inference. Cloudflare production requests use
a separate 12-second default; increasing the Ollama allowance does not change that hosted bound.

## What the model does

For each chat message, Ollama returns a strict latest-turn delta: intent, fields explicitly changed
in that message, its explicit limitations declaration, possible safety signals, and assumptions.
The model does not report missing fields or completion and does not build the routine.

Application/domain code then:

1. Reconciles raw-text safety signals and refuses a model-only all-clear.
2. Merges the delta into the canonical v2 request draft.
3. Derives missing fields, completion, and at most two focused follow-up questions.
4. Converts a complete and safe draft to `RoutineRequest`.
5. Generates and validates the plan with the deterministic engine and approved local catalog.
6. Shows the routine inline and optionally asks Ollama to phrase a response from bounded validated
   context.

Response wording and plan explanations are capped at 1,500 characters. If wording fails after the
structured state has been accepted, deterministic Spanish fallback copy is used without discarding
the profile or plan.

## Start FORMA

In another terminal:

```bash
npm run dev
```

Open `http://localhost:3000/crear/chat`. A complete Spanish turn can be:

```text
Soy intermedio. Quiero hipertrofia cuatro días, 45 minutos por sesión, en el gimnasio con mancuernas y máquinas. No tengo dolor, lesiones, síntomas ni restricciones.
```

A multi-turn exchange works as well: only the latest message is interpreted by the model, then its
validated delta is deterministically merged with the already persisted draft.

## Contract verification

The standard gate never contacts Ollama:

```bash
npm run validate
```

Run the external provider contract separately while Ollama is active. Set the model explicitly;
without `OLLAMA_MODEL` or `OLLAMA_MODELS`, the script intentionally probes both configured matrix
models.

PowerShell:

```powershell
$env:OLLAMA_MODEL='qwen3:1.7b'
$env:AI_PROBE_REPETITIONS='1'
npm run test:ollama
```

Bash:

```bash
OLLAMA_MODEL=qwen3:1.7b AI_PROBE_REPETITIONS=1 npm run test:ollama
```

The probe exercises seven capabilities through the real provider: a complete turn, incomplete-turn
derivation, preservation of an explicit profile across a separate safety-confirmation turn,
conversational response composition, bounded modification, preservation of a deterministic safety
signal, and explanation of validated plan facts.

### Recorded result — 2026-07-28

- `qwen3:1.7b`: real local Ollama inference passed 7/7 checks in one repetition.
- `qwen3:4b`: not installed on the verification machine. It was intentionally not downloaded, so
  no 4b result is claimed.

To complete the 4b matrix manually:

```powershell
ollama pull qwen3:4b
$env:OLLAMA_MODEL='qwen3:4b'
$env:AI_PROBE_REPETITIONS='1'
npm run test:ollama
```

The first command downloads external model data and must remain an explicit operator choice. Do
not mark 4b as passing until the JSON report has `passed: true` and all seven checks pass.

You can check endpoint/model reachability independently:

```powershell
Invoke-RestMethod http://127.0.0.1:11434/api/tags
```

Reachability alone does not prove structured-output reliability; the seven-check provider contract
is the acceptance test.

## Failure behavior

FORMA distinguishes and presents actionable local failures:

- `unavailable`: Ollama is not reachable; start it and retry.
- `unsupported_model`: the configured model is not installed; review `OLLAMA_MODEL` or pull it
  manually.
- `timeout`: the local model exceeded the bounded deadline.
- `aborted`: a newer message superseded this request.
- `response_too_large`: output exceeded the response-byte limit.
- `invalid_output`: the original output and one repair attempt both failed strict validation.
- `misconfigured`: the server-only provider configuration is invalid.

The chat displays a precise Spanish message, keeps the user message and structured draft, offers a
retry when appropriate, and links to `/crear/manual`. Provider/model identifiers are visible only
in development diagnostics; normal production UI does not expose them.

No provider error may discard earlier answers or a validated routine. If response composition
fails after a turn was merged or a routine was generated, the deterministic response fallback
describes the preserved result.

## Troubleshooting

- **Ollama is not reachable:** start the application and check `OLLAMA_BASE_URL`; never replace it
  with a browser-facing URL.
- **The model is absent:** run the explicit `ollama pull <configured-model>` command and verify the
  exact `OLLAMA_MODEL` tag with `/api/tags`.
- **Frequent timeouts:** confirm the machine can run the selected model and keep
  `AI_TIMEOUT_MS=60000`; do not remove the deadline or exceed the documented maximum.
- **Repeated invalid output:** continue through `/crear/manual` and record model/version/check
  metadata without logging private user text. Never use partially validated fields.
- **The old request was cancelled:** expected when a new turn supersedes it. The newest canonical
  state remains authoritative.
- **Testing only 1.7b or only 4b:** set `OLLAMA_MODEL` explicitly before `npm run test:ollama` so an
  intentionally missing matrix model does not obscure the result being verified.
