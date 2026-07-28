# Architecture decisions

## ADR-001 — Immutable design evidence

The files under `docs/design-reference/` are evidence, not runtime assets. Their manifest is validated independently and the application never imports the remote sample imagery embedded in the Stitch HTML.

## ADR-002 — Source media is local-only until licensing review

The pinned Gym Visual JPG and GIF files may be imported into `.local-media/` for local development and private evaluation. That directory is ignored by Git and no build step copies it into `public/`, `.next/` or the Cloudflare deployment package. Production resolves media to an explicit unavailable state until permission is confirmed.

## ADR-003 — Deterministic domain core

Routine construction, safety validation, exercise retrieval and substitutions are pure deterministic domain operations. AI may translate conversational text into the same validated `RoutineRequest` accepted by the guided form, but it cannot invent exercises or bypass validation.

## ADR-004 — RIR is authoritative

Every prescription stores repetitions-in-reserve (RIR). RPE may be derived only for presentation with `RPE = 10 - RIR`; it is never a separately editable domain value.

## ADR-005 — Provider and runtime isolation

AI providers live behind one server-only contract. Ollama is the local adapter, Cloudflare Workers AI is the production adapter, and Mock/Disabled adapters keep development and the non-AI path operational. UI, persistence and domain code do not import vendor SDKs.

## ADR-006 — Browser persistence behind repositories

MVP data is versioned in browser storage through repository interfaces. Components and domain code never access `localStorage` directly.

## ADR-007 — Node 22 baseline

The Cloudflare/OpenNext, Vite and DOM test toolchain currently requires Node 22. The repository therefore declares Node `>=22.13.0`; validation on the host is run through a Node 22 shim when the system default is older.

## ADR-008 — Review digest gates automatic generation

Source-valid does not mean programming-approved. Automatic generation uses only the 156 records
that passed the implementation source-consistency review. Curated metadata, Spanish names, and
explicit exclusions are protected by digest
`9f1d32edb076e1a56fe68e14e2ab256e2e41bb7d8ca97f586f3b78ec1a3a0c7c`; a changed reviewed
record requires deliberate regeneration/re-review. All other valid source records remain
searchable but cannot enter a routine.

## ADR-009 — Required equipment is conservative and directional

Curated secondary requirements (bench, rack, bars, anchor, platform, and integrated equipment)
are treated as real requirements. Compatibility is directional: a generic `machine` does not
satisfy `smith_machine`; a Smith may satisfy a generic-machine classification only where the
curated contract permits it. Commercial-gym presets enumerate supporting equipment rather than
silently ignoring it.

## ADR-010 — One local search index, no retrieval service

MiniSearch is built from the generated compact catalog and alias map, memoized at module scope,
and reused by the explorer/application search boundary. Search submits explicitly rather than
issuing a request per keystroke, so no debounce timer or remote/vector index is required.

## ADR-011 — Stitch fidelity through tokens and semantic components

Stitch screenshots/HTML remain immutable evidence, not copied application code. FORMA uses their
editorial hierarchy, mobile-first composition, navy/cream palette, lines, restrained radii, and
routine/chat patterns through local tokens and CSS Modules. Tailwind supplies a small utility
layer. Accessibility and deterministic correctness override pixel-level fidelity.

## ADR-012 — Local protected media uses a private route

The GOAL example suggested `public/exercises/media`, but the separate Gym Visual licensing
boundary prohibits including protected binaries in public production artifacts. Local/private
development therefore uses a manifest-whitelisted development route backed by `.local-media`.
Production cannot activate that mode; separately licensed replacements can use the same exercise
IDs through the central resolver.

## ADR-013 — Public AI rate limiting has no paid dependency

The route applies a bounded fixed-window guard per client and worker isolate. This satisfies the
MVP burst-control boundary without adding storage or a paid service. It is deliberately not
represented as a globally consistent quota; Workers AI rate/quota enforcement remains
authoritative and high-volume launches must review account-level controls.

## ADR-014 — Granite requires an account-backed gate

The configured Cloudflare model is
`@cf/ibm-granite/granite-4.0-h-micro` in forced function-calling mode. The adapter is fully
contract-tested with a simulated binding, but a target-account runtime probe consumes inference
and remains manual. A fallback model stays unset until it passes the identical contract; invalid
output never causes automatic model shopping or weaker validation.

## ADR-015 — Structured AI stays atomic instead of streaming

State-changing AI results are displayed only after the complete payload has passed strict Zod
validation. Provider streaming is therefore not used for structured state in the MVP; staged
deterministic UI feedback is shown while awaiting the bounded atomic response. This prevents
partial unvalidated fields from entering application state.

## ADR-016 — No server persistence or cache service

OpenNext packages the Node.js runtime for Workers, but FORMA adds no R2, D1, KV, authentication,
or server routine store. Generated catalogs are immutable bundled data and routines remain in
the versioned browser repository. This keeps the useful no-AI product independent of external
state and avoids silently adding paid services.

## ADR-017 — Conversation is the canonical creation surface

`/crear/chat` is FORMA's primary creation workspace and `/crear` redirects there. The guided
builder remains at `/crear/manual` as a provider-independent fallback, accessibility alternative,
and precise editor of the same profile. This changes product hierarchy without replacing the
Stitch-derived visual system: `docs/design-reference/**` remains immutable evidence, while the
chat workspace reuses the established tokens, navigation, responsive patterns, and accessibility
priority.

## ADR-018 — Models extract a latest-turn delta, not application state

`ParsedRoutineTurn` contains only latest-turn intent, an explicit `RoutineRequest` patch, the
latest limitation declaration, possible safety signals, and assumptions. Empty patches are valid
for greetings and questions. Missing fields, completion percentage, parse status, final safety
eligibility, and routine validity are deliberately absent from model output and are recomputed by
pure application/domain functions after strict Zod validation and canonical merge. Small-model
compatibility cannot justify weakening this boundary or accepting partial output.

## ADR-019 — One versioned conversation aggregate owns editable state

The v2 browser envelope stores messages, the editable request draft, limitation confirmation,
safety state, current validated routine, provider state, retry metadata, and update time as one
`RoutineConversationState`. The repository, not callers or storage, derives missing fields and
completion on every boundary. Guided-form and legacy compatibility methods update this same
aggregate, and valid v0/v1 data migrates into it. Chat keeps the generated plan paired with the
exact request and safety screening that produced it; that generation snapshot is immutable during
chat edits. The guided form may update the paired request/screening only when the existing plan
still validates; otherwise the stale current-plan pointer is removed without touching saved plans.

## ADR-020 — Assistant prose verbalizes validated truth

Natural response composition is a provider capability over `ComposeAssistantResponseInput`, a
strict and bounded projection of canonical profile state, deterministic safety/completeness,
allowed actions, and optional validated plan or grounded exercise summaries. The provider may
choose wording only. If composition, plan explanation, or the provider fails, application code
returns a contextual deterministic response and a typed provider error without changing the
profile or plan. Structured state changes remain atomic and require complete schema validation.

## ADR-021 — Deterministic safety can only be made more conservative

Raw user text is checked before and after provider extraction. Deterministic safety signals are
unioned with model signals, never removed by a provider, and a model-only `no_limitations` value
cannot grant the canonical all-clear. Routine generation requires an explicit deterministic
confirmation, zero safety signals, a complete domain request, and the existing screening/domain
validation. A complete manual review can explicitly correct a false-positive conversational signal
only when the domain assessment is eligible; any remaining risk keeps the signal and blocks
generation. Provider classification is advisory and cannot turn an unsupported request into an
eligible one.

## ADR-022 — Chat questions and changes cross bounded application services

Exercise answers resolve only validated local catalog records and current-plan placements; the
bounded context includes Spanish instructions, catalog facts, curated substitutions,
deterministic selection reasons, and resolved media attribution. Chat modifications are parsed to
typed commands, then executed by deterministic replace/remove/remove-by-muscle/reorder/regenerate/
shorten-day/exclude-equipment use cases and
validated again. Unaffected days remain stable for local edits. A profile change retains the
existing plan when it still validates and permits a full deterministic rebuild only when the new
request invalidates the plan's structure.

## ADR-023 — Provider differences stay operational, not architectural

Mock, Disabled, Ollama, and Cloudflare remain behind the same server-only contract. Ollama uses a
local 60-second default, temperature zero, disabled thinking where supported, JSON Schema output,
bounded responses, and one repair attempt. Cloudflare uses the Workers AI binding and its own
bounded timeout/error mapping. The shared taxonomy distinguishes unavailable, timeout,
invalid-output, rate-limit, quota, binding, configuration, and unsupported-model failures; normal
production UI does not expose provider or model identifiers.
