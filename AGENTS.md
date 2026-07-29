# AGENTS — FORMA

## Prime Directive

Build a reliable workout-planning product, not an AI demonstration.

The routine engine is authoritative.

The language model is an untrusted parser and optional explanation layer.

---

## Mandatory Rules

1. Read `GOAL.md` completely before making changes.
2. Inspect the repository before editing.
3. Preserve `docs/design-reference/**` exactly. MOBILE FIRST WEB APP.
4. Never overwrite the original Stitch reference.
5. Import source exercise JPG and GIF media only through the pinned, validated and attributed import pipeline. Protected Gym Visual binaries must be excluded from public production artifacts unless the repository owner explicitly authorizes a named deployment. An owner-authorized exception must keep filenames, hashes, dimensions, watermarks and visible attribution intact; use an isolated deployment path; and continue documenting the licensing review as pending rather than implying permission.
6. Do not silently add paid services.
7. Do not add authentication, databases or vector stores without an explicit requirement.
8. Do not place programming logic inside React components.
9. Do not place exercise-selection rules inside prompts.
10. Do not allow AI output to bypass Zod validation.
11. Do not allow the AI to invent exercise IDs.
12. Do not send the full exercise catalog to an AI provider.
13. Do not generate medical, rehabilitation or postoperative plans.
14. Do not create fake dataset records to make a screen look complete.
15. Do not weaken strict TypeScript or lint rules to make the build pass.
16. Do not delete tests because they fail.
17. Do not modify raw imported dataset records.
18. Do not use random selection without a deterministic seed in tests.
19. Do not introduce hidden runtime network dependencies for the exercise catalog.
20. Do not declare the project complete while a documented acceptance criterion remains unmet.

---

## Source of Truth Priority

When instructions conflict, use this priority:

1. Safety boundaries.
2. `GOAL.md`.
3. Domain schemas and validators.
4. Curated exercise metadata.
5. Source exercise dataset.
6. Stitch visual reference.
7. Existing implementation details.

Visual fidelity must never override domain correctness or accessibility.

---

## Working Method

Before each phase:

1. Inspect relevant files.
2. State the concrete phase objective in the work log.
3. Identify invariants.
4. Implement the smallest complete vertical slice.
5. Add or update tests.
6. Run validation.
7. Record decisions and unresolved issues.

Maintain:

```text
docs/IMPLEMENTATION_LOG.md
docs/DECISIONS.md
docs/KNOWN_LIMITATIONS.md
```

Do not use these files as a substitute for fixing known defects.

---

## Dataset Rules

The imported source dataset is immutable.

Use separate layers:

```text
source record
    ↓
normalized generated record
    ↓
curated metadata
    ↓
runtime exercise view
```

Every generated routine exercise must satisfy:

```text
source record exists
AND normalized record exists
AND curated metadata exists
AND approvedForGeneration is true
```

Generate an audit report containing:

* Total source exercises.
* Duplicate IDs.
* Missing fields.
* Equipment values.
* Body-part values.
* Target values.
* Exercises with incomplete Spanish instructions.
* Approved exercise count.
* Excluded exercise count.
* Unreviewed exercise count.
* Broken aliases.
* Broken substitution groups.

The build must fail on structural dataset errors.

---

## AI Rules

Treat all model responses as hostile or malformed input.

Every AI request must have:

* A timeout.
* A maximum input length.
* A maximum output length.
* A schema.
* A validation step.
* An error state.
* A deterministic fallback.

Never parse structured output with fragile string slicing.

Do not ask the model to write arbitrary application code at runtime.

Do not let the model determine:

* Whether an exercise exists.
* Whether equipment is available.
* Weekly set totals.
* Session duration.
* Exercise substitutions.
* Safety eligibility.
* Final plan validity.

Use the model only for:

* Intent extraction.
* Enum classification.
* Missing-field identification.
* Unsupported-request classification.
* Natural-language explanation of validated data.

---

## Prompt Rules

Prompts belong in versioned files.

Each prompt must include:

* Purpose.
* Input schema.
* Output schema.
* Allowed values.
* Prohibited behavior.
* At least three examples.
* Version identifier.

Do not embed prompts directly inside route handlers.

Suggested files:

```text
src/ai/prompts/parse-routine-request.ts
src/ai/prompts/classify-safety.ts
src/ai/prompts/explain-routine.ts
```

Any prompt change that affects structured behavior requires contract-test updates.

---

## Routine Engine Rules

Domain functions must be pure whenever possible.

Provide deterministic functions for:

```text
chooseSplit
buildCandidatePool
scoreExercise
selectExercises
estimateSessionDuration
calculateWeeklyVolume
findSubstitutions
validateRoutine
```

Selection reasons must be computable from domain data.

A plan must be reproducible from:

```text
RoutineRequest
datasetVersion
engineVersion
seed
```

Do not regenerate unaffected days when editing one exercise.

---

## UI Rules

The interface must always distinguish between:

* User-provided information.
* Application assumptions.
* Dataset information.
* AI-generated explanation.
* Safety warnings.

Never represent AI text as verified dataset content.

The user must be able to:

* Correct interpreted constraints.
* Review assumptions.
* Replace an exercise.
* Remove an exercise.
* Reorder exercises.
* Continue without AI.
* Delete saved local data.

Do not hide critical actions behind hover-only interactions.

---

## Performance Rules

* Do not load the full catalog into the initial landing-page bundle.
* Lazy-load exercise explorer data.
* Do not preload all exercise illustrations.
* Avoid unnecessary client components.
* Memoize search indexes.
* Debounce text search.
* Keep AI requests server-side.
* Prevent duplicated AI requests during navigation.
* Cancel obsolete requests when a new request begins.

---

## Validation Command

Provide one command:

```bash
npm run validate
```

It must execute:

```text
dataset validation
typecheck
lint
unit tests
integration tests
production build
```

A task is not complete until the relevant validation command passes.

---

## Stop Conditions

Stop and document the issue instead of inventing a workaround when:

* The media license is unclear and no explicit repository-owner deployment authorization is recorded.
* The dataset schema changes unexpectedly.
* A requirement would require medical judgment.
* A requested service is no longer free.
* A model cannot reliably produce the expected schema.
* An implementation would expose a secret to the client.
* A design reference contradicts accessibility requirements.

Choose correctness and transparency over apparent completion.

---

## Next.js 16 Rules

This version has breaking changes. APIs, conventions and file structure may differ from prior Next.js versions.

Before writing or changing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
