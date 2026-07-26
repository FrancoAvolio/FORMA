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
