# AI architecture

## Product role and trust boundary

FORMA is chat-first, but it is not model-driven. `/crear/chat` is the primary creation surface and
`/crear` redirects there. The provider interprets the latest user turn and may phrase a response;
canonical state, completeness, safety, routine construction, catalog lookup, and validation remain
application/domain responsibilities. `/crear/manual` reads and writes the same profile aggregate
and can complete the full product flow with `AI_PROVIDER=disabled`.

```text
             latest user message
                    |
                    v
          server-only AiProvider
                    |
                    v
      strict ParsedRoutineTurn delta
                    |
                    v
deterministic reconcile + merge + derived state
                    |
          +---------+----------+
          |                    |
     needs input          complete + safe
          |                    |
          |                    v
          |        deterministic routine engine
          |        + approved local catalog
          |        + final routine validator
          |                    |
          +---------+----------+
                    v
 bounded validated response context
                    |
                    v
 provider wording or deterministic Spanish fallback
```

The model never reports authoritative missing fields, completion percentage, parse status, safety
eligibility, or routine validity. It never selects exercise IDs or receives the complete catalog.

## Turn contract and deterministic derivation

`AiProvider.parseRoutineTurn` returns only facts attributed to the latest message:

```ts
type ParsedRoutineTurn = {
  intent:
    | "greeting"
    | "provide_information"
    | "modify_profile"
    | "modify_routine"
    | "ask_question"
    | "unsupported"
    | "other";
  requestPatch: RoutineRequestPatch;
  limitationsConfirmation: "unknown" | "no_limitations" | "has_limitations";
  safetySignals: SafetySignal[];
  assumptions: string[];
};
```

An omitted patch key means “not mentioned in this turn”; `null` explicitly clears a supported
value. Empty patches are valid for greetings and questions. After strict Zod validation,
application functions:

1. Re-run deterministic raw-text safety detection and union its signals with provider signals.
2. Prevent a model-only `no_limitations` value from granting an all-clear.
3. Merge the validated delta into the canonical draft; arrays are replaced as units.
4. Derive all missing required fields and the completion percentage.
5. Select at most two focused follow-up fields while keeping every missing field visible in the
   structured profile.
6. Convert to `RoutineRequest` only when the canonical profile is complete.
7. Require explicit deterministic limitations confirmation, zero blocking signals, and the domain
   safety screening before generation.
8. Generate and validate the routine with the deterministic engine and approved catalog.

Safety classifications from a provider are advisory. They can add caution but cannot remove a
deterministic signal, authorize a medical/rehabilitation request, or grant generation eligibility.

## Canonical browser state

The browser repository uses the `forma:routines:v2` envelope. One
`RoutineConversationState` owns:

- conversation messages;
- the editable `RoutineRequestDraft` and limitations confirmation;
- deterministically derived missing fields and completion percentage;
- safety signals, screening, and the latest domain assessment;
- the current validated routine and its exact generation snapshot;
- provider state, retry metadata, and update time.

The repository re-derives missing fields and completion at every read/write boundary instead of
trusting serialized values. Valid v0/v1 data is migrated into v2. Guided-form compatibility
methods update this same aggregate, so switching between `/crear/chat` and `/crear/manual` does
not create competing copies of the profile or routine.

## Assistant response composition

`AiProvider.composeAssistantResponse` receives `ComposeAssistantResponseInput`: a strict bounded
projection containing the canonical draft, deterministic missing/completion/safety state, at most
two focused questions, allowed next actions, assumptions, and optional validated plan or grounded
exercise summaries. The provider chooses natural Spanish wording only.

Assistant and plan-explanation output is limited to 1,500 characters. It cannot introduce state,
new catalog facts, or new actions. If response composition or explanation fails, the application
returns a contextual deterministic Spanish response while retaining the successfully merged state
and routine.

## Grounded questions and modifications

The chat stays active after generation and routes follow-up work through bounded server/application
interfaces:

- `POST /api/ai/interpret` validates and extracts the latest-turn delta.
- `POST /api/ai/respond` verbalizes validated context and returns deterministic fallback prose on
  provider failure.
- `POST /api/ai/modify` parses a change against a limited current-plan summary; deterministic use
  cases execute replace, remove, reorder, one-day regeneration, or profile updates and then
  validate again.
- `POST /api/ai/exercise` resolves an exercise already present in the validated routine to local
  catalog facts, Spanish instructions, curated alternatives, media metadata, and attribution.
- `POST /api/ai/explain` explains a bounded validated plan summary, with a deterministic fallback.

The model cannot invent an exercise placement or choose a replacement. A replacement command
identifies the existing day/exercise and an optional natural-language preference; the domain
substitution service selects an approved compatible exercise. Unaffected days remain stable for
local edits. Exercise answers never use remote retrieval and never infer facts absent from the
local validated catalog.

## Code boundaries

- `src/ai/ai-provider.ts`: provider-neutral interface.
- `src/ai/schemas/**`: strict request/response contracts; unknown output keys fail.
- `src/ai/prompts/**`: versioned prompts with purpose, contracts, allowed values, prohibited
  behavior, and examples.
- `src/ai/providers/base-structured-provider.ts`: common input validation, full JSON Schema
  delivery, one repair attempt, and final Zod validation.
- `src/ai/providers/ollama-provider.ts`: server-side Ollama HTTP protocol only.
- `src/ai/providers/cloudflare-provider.ts`: injected Workers AI binding only.
- `src/ai/providers/mock-provider.ts`: deterministic test/demo behavior and configurable failures.
- `src/ai/providers/disabled-provider.ts`: immediate provider-disabled state.
- `src/ai/providers/provider-factory.ts`: the only environment-based composition point.
- `src/ai/contract-probe.server.ts`: opt-in, usage-consuming provider contract verification.
- `src/application/conversation/**`: deterministic turn merge, safety reconciliation, grounded
  question resolution, and fallback composition.
- `src/application/routines/**`: deterministic generation and typed routine changes.
- `src/persistence/routine-conversation-state.ts`: canonical v2 aggregate schema.

Provider implementations and the factory import `server-only`. Client code may import shared
types/schemas but never `src/ai/providers/**`. Cloudflare bindings and Ollama URLs are not
serialized to a Client Component. Provider/model diagnostics appear only in development responses
and the development diagnostics panel; normal production UI and API success/error payloads do not
expose them.

## Structured-output lifecycle

Each state-changing provider call follows the same sequence:

1. Remove the `AbortSignal` from prompt data and validate the remaining input.
2. Enforce message, list, plan, and serialized-input limits.
3. Generate the complete draft-07 JSON Schema from the relevant Zod schema.
4. Send the versioned system prompt, delimited untrusted data, and complete schema.
5. Enforce the provider deadline and response byte limit.
6. Parse only a complete JSON value; markdown fences and substring extraction are unsupported.
7. Validate with the strict Zod schema.
8. On invalid JSON/schema output, send one versioned repair request with bounded issues and a
   bounded copy of the invalid output.
9. Validate again; if it still fails, throw `invalid_output` and use no partial result.

Provider transport errors are not repaired as JSON. Caller aborts, timeouts, oversized responses,
unavailable services, rate limits, quota exhaustion, unsupported models, and missing/malformed
bindings have distinct error codes. All provider inputs accept an optional `AbortSignal`; a newer
turn cancels obsolete work.

## Limits and operational defaults

Current bounds live in `src/ai/limits.ts`:

- User message: 4,000 characters.
- Serialized application request: 32 KiB.
- Provider request: 256 KiB.
- Provider/model response: 64 KiB.
- Assistant response or plan explanation: 1,500 characters.
- Cloudflare/default hosted deadline: 12 seconds.
- Ollama local deadline: 60 seconds.
- Configurable deadline range: 1–60 seconds.
- Repair attempts: exactly one.

Ollama's longer default accommodates local CPU/GPU inference; it does not increase the production
Cloudflare deadline. Logs contain only provider, operation, model, attempt, duration, and typed
error code. Prompts, user text, and raw model output are excluded.

## Provider configuration

Supported `AI_PROVIDER` values are `ollama`, `cloudflare`, `mock`, and `disabled`. When omitted,
development/test select Ollama and production selects Cloudflare. Explicit configuration is still
recommended.

```env
AI_PROVIDER=ollama
AI_TIMEOUT_MS=60000
AI_DEBUG_LOGS=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

```env
AI_PROVIDER=cloudflare
AI_TIMEOUT_MS=12000
AI_DEBUG_LOGS=false
CLOUDFLARE_AI_MODEL=@cf/ibm-granite/granite-4.0-h-micro
CLOUDFLARE_AI_STRUCTURED_MODE=function_calling
# Set only after a smaller fallback passes the identical live contract.
CLOUDFLARE_AI_FALLBACK_MODEL=
```

Cloudflare uses the injected `AI` binding, structurally equivalent to
`env.AI.run(model, request, { signal })`; it does not use account credentials in application code.
The configured `function_calling` mode forces a schema-bearing function call. The adapter also
supports `json_schema` and `json_object` modes without changing the provider interface.

## Verification evidence and remaining gates

Standard tests use Mock AI, a simulated Ollama transport, and a simulated Workers AI binding. They
require no local model, Cloudflare account, credentials, or paid inference.

Recorded on 2026-07-28:

- Real Ollama `qwen3:1.7b`: 7/7 semantic contract checks passed in one repetition, including
  preservation of an explicit profile across a separate safety-confirmation turn.
- Ollama `qwen3:4b`: not installed and not downloaded automatically; no result is claimed.
- Simulated Cloudflare binding: 11/11 tests passed without inference usage.
- OpenNext build and Wrangler deployment dry-run passed, and the packaged artifact scan found zero
  protected Gym Visual binaries.

The real Workers AI binding and configured Granite model still require the target account's manual
contract probe. A package build or simulated test cannot establish live model behavior, quota, or
deployment authorization. If Granite fails, do not weaken Zod or parse partial output: test a
currently supported smaller model against the identical contract, record the evidence, and only
then change `CLOUDFLARE_AI_MODEL` or configure a fallback.

External checks remain deliberately outside `npm run validate`:

```text
npm run test:ollama
npm run test:cloudflare
```

See [`LOCAL_AI_SETUP.md`](LOCAL_AI_SETUP.md) and
[`CLOUDFLARE_DEPLOYMENT.md`](CLOUDFLARE_DEPLOYMENT.md) for exact commands and manual gates.
