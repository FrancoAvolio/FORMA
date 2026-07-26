# AI architecture

## Role and trust boundary

FORMA is a workout-planning product with an optional language interface. The
deterministic routine engine is authoritative. An AI provider may extract intent,
classify enums, report missing information, flag safety-sensitive language and
explain already validated facts. It may not select exercises, calculate volume or
duration, choose substitutions, decide safety eligibility, or validate a plan.

```text
chat text / current structured state
              |
              v
       server-only AiProvider
              |
              v
 hostile response -> Zod contract -> validated draft or typed failure
                                      |
guided form --------------------------+
                                      v
                         deterministic application/domain layer
```

Both chat and the guided form converge on the domain `RoutineRequestSchema`. A
parsed chat result remains a draft until all domain fields and the separate,
explicit limitations confirmation are present. `toCompleteRoutineRequest` is the
only AI helper that converts a parsed result to the domain request; it returns
`null` unless both conditions hold.

Safety classifications from a model are advisory. The domain keyword/state
screen remains mandatory and authoritative. Provider validation prevents a model
from deleting deterministic signals supplied to `classifySafety`, but a valid AI
classification never grants eligibility by itself.

## Code boundaries

- `src/ai/ai-provider.ts`: provider-neutral interface.
- `src/ai/schemas/**`: strict input/output contracts. Unknown output keys fail.
- `src/ai/prompts/**`: versioned prompts with purpose, contracts, allowed values,
  prohibited behavior and three examples each.
- `src/ai/providers/base-structured-provider.ts`: common input validation, full
  JSON Schema delivery, one repair attempt and final Zod validation.
- `src/ai/providers/ollama-provider.ts`: server-side Ollama HTTP protocol only.
- `src/ai/providers/cloudflare-provider.ts`: injected Workers AI binding only.
- `src/ai/providers/mock-provider.ts`: deterministic test/demo behavior and
  configurable typed failures.
- `src/ai/providers/disabled-provider.ts`: immediate guided-form state.
- `src/ai/providers/provider-factory.ts`: the only environment-based composition
  point.
- `src/ai/contract-probe.server.ts`: opt-in, usage-consuming provider contract
  verification. It is never called during standard tests or startup.

Provider implementations and the factory import `server-only`. Client code may
import shared types/schemas but must never import `src/ai/providers/**`.
Cloudflare bindings, Ollama URLs and provider responses are never serialized to a
Client Component.

## Structured-output lifecycle

Each state-changing call follows the same sequence:

1. Remove the `AbortSignal` from prompt data and validate the remaining input.
2. Enforce message, list and serialized-input limits.
3. Generate the complete draft-07 JSON Schema from the relevant Zod schema.
4. Send the versioned system prompt, untrusted user data in a delimiter, and the
   complete schema to the provider.
5. Enforce the provider deadline and response byte limit.
6. Parse only a complete JSON string (or provider-native object). Markdown fences
   and substring extraction are intentionally unsupported.
7. Validate with the strict Zod schema.
8. On invalid JSON or schema output, send one versioned repair request containing
   bounded validation issues and a bounded copy of the invalid output.
9. Validate again. If it still fails, throw `invalid_output`; no partial object is
   returned.

Provider transport errors are never repaired as if they were JSON. Caller aborts,
timeouts, oversized responses, unavailable services, rate limits, quota
exhaustion, unsupported models and missing bindings have distinct error codes.
`toAiFallbackState` deterministically maps them to preserved-state guided-form UI
copy.

Modification output is additionally validated against the supplied, limited plan
context. The model can reference only an existing day or an existing
`dayId`/`exerciseId` placement. A replace intent names that current placement and
an optional natural-language preference; the domain substitution engine chooses
the replacement.

## Limits and cancellation

The current bounded defaults live in `src/ai/limits.ts`:

- User message: 4,000 characters.
- Serialized application input: 32 KiB.
- Provider request: 256 KiB.
- Provider/model response: 64 KiB.
- Explanation: 2,000 characters.
- Default deadline: 12 seconds (configurable from 1–60 seconds).
- Repair attempts: exactly one.

All provider inputs accept an optional `AbortSignal`. A route/application use case
must abort the previous request when a newer user request supersedes it. Both the
Ollama fetch and Workers AI binding receive the composed deadline/caller signal.

Logs contain only provider, operation, model, attempt, duration and typed error
code. Prompts, user text and raw model output are deliberately excluded.

## Provider configuration

Supported values for `AI_PROVIDER` are `ollama`, `cloudflare`, `mock` and
`disabled`. If omitted, local/test environments use Ollama and production uses
Cloudflare. Explicit production configuration is still recommended.

```env
AI_PROVIDER=ollama
AI_TIMEOUT_MS=12000
AI_DEBUG_LOGS=false
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

```env
AI_PROVIDER=cloudflare
CLOUDFLARE_AI_MODEL=@cf/ibm-granite/granite-4.0-h-micro
CLOUDFLARE_AI_STRUCTURED_MODE=function_calling
# Set only after a smaller fallback has passed the same external contract.
CLOUDFLARE_AI_FALLBACK_MODEL=
```

Cloudflare uses an injected binding structurally equivalent to
`env.AI.run(model, request, { signal })`; it does not use account credentials.
The default `function_calling` mode forces a schema-bearing function call. The
adapter also supports `json_schema` and `json_object` modes without changing the
provider interface.

## Granite verification status

The repository contract-tests the Cloudflare adapter with a simulated binding,
including the complete schema, forced tool selection, response validation,
repair, quota mapping, binding absence and an unsupported-model fallback. These
tests do not spend Workers AI quota.

The configured Granite model still requires an account-backed contract probe in
the real Workers runtime. Public documentation has not provided enough evidence
to claim that every account/runtime combination reliably returns the required
shape. `runAiProviderContractProbe` runs five semantic checks three times by
default and reports only pass/fail metadata. It consumes inference and therefore
must be invoked explicitly after the `AI` binding is authorized.

Do not silently change models. If Granite fails any repeated probe:

1. Keep the provider architecture and prompts unchanged.
2. Test the smallest currently available Workers AI model that supports the same
   forced structured contract.
3. Record model ID, structured mode, date, repetitions and failures in
   `docs/DECISIONS.md` and `docs/KNOWN_LIMITATIONS.md`.
4. Set `CLOUDFLARE_AI_MODEL` to the passing model. Optionally retain the verified
   alternative in `CLOUDFLARE_AI_FALLBACK_MODEL` for unsupported-model errors.

The fallback is attempted only when Workers AI reports that the primary model is
unsupported. It is not used to hide repeated malformed output or quota errors.

## Standard and external tests

Standard unit/contract tests use Mock AI, a simulated Ollama transport and a
simulated Cloudflare binding. They require no network, credentials, local Ollama,
Cloudflare account or paid inference.

External Ollama and Cloudflare checks must remain separate from `npm run validate`.
Recommended scripts are:

```text
npm run test:ollama
npm run test:cloudflare
```

They should opt in to real inference, call the same provider interface/contract
probe, and fail closed when the provider cannot meet the contract.
