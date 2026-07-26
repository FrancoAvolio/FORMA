# GOAL — FORMA

## 1. Mission

Build a polished, production-quality Spanish-language web application that allows users to describe the workout routine they need in natural language and receive a structured, explainable and editable training plan.

The application must use the `hasaneyldrm/exercises-dataset` repository as its source exercise catalog.

The system must not treat the language model as the source of truth. The language model interprets user intent and produces structured data. Exercise selection, routine construction, validation and safety constraints are implemented with deterministic application code.

Working product name: **FORMA**.

The product name and visual identity may be replaced later without changing the domain architecture.

---

## 2. Core Product Promise

A user should be able to write:

> “Armame una rutina de hipertrofia de cuatro días, de menos de una hora, con mancuernas y máquinas. No quiero hacer peso muerto.”

The application must:

1. Understand the requested goal and constraints.
2. Ask only for essential missing information.
3. Convert the conversation into a validated `RoutineRequest`.
4. Select only exercises that exist in the local catalog.
5. Construct a balanced routine using deterministic programming rules.
6. Validate the complete routine.
7. Show the routine in a clear weekly format.
8. Allow the user to inspect, replace, reorder and remove exercises.
9. Save the resulting routine locally.
10. Explain why each exercise and training day was selected.

---

## 3. Non-negotiable Architecture

The system must be divided into four independent layers.

### 3.1 Conversation Layer

Responsible for:

* Chat interface.
* User messages.
* Suggested prompts.
* Missing-information questions.
* Streaming and loading states.
* Presentation of generated plans.

It must not contain workout-programming logic.

### 3.2 AI Interpretation Layer

Responsible for:

* Parsing natural-language requests.
* Producing a structured `RoutineRequest`.
* Detecting missing required fields.
* Classifying unsafe or unsupported requests.
* Producing optional human-readable explanations from an already validated plan.

The AI layer must never:

* Invent exercise IDs.
* Directly produce the final authoritative routine.
* Bypass deterministic validators.
* Receive the complete raw dataset in every prompt.
* provide medical diagnoses or rehabilitation plans.

### 3.3 Routine Engine

Responsible for:

* Filtering eligible exercises.
* Applying split templates.
* Assigning movement patterns.
* Balancing muscle groups.
* Selecting compound and isolation movements.
* Calculating estimated session duration.
* Assigning sets, repetitions, rest and effort targets.
* Avoiding duplicate or conflicting movements.
* Selecting substitutions.

This layer must be deterministic, testable and independent from React and the AI provider.

### 3.4 Validation Layer

Responsible for verifying:

* Every exercise ID exists.
* Every exercise has approved local metadata.
* Equipment matches the user's availability.
* Excluded movements do not appear.
* No unsupported medical request was accepted.
* Session duration is within tolerance.
* Weekly volume is within configured limits.
* Movement patterns are reasonably balanced.
* Muscle groups receive appropriate recovery.
* No exact exercise is duplicated accidentally.
* Sets, repetitions and rest values are valid.
* All generated text derives from validated plan data.

No routine may reach the UI as “ready” before passing validation.

---

## 4. Technology

Use:

* Next.js 16.
* App Router.
* TypeScript in strict mode.
* React Server Components by default.
* Client Components only where interactivity requires them.
* Tailwind CSS.
* Zod for runtime schemas.
* Vitest for unit and integration tests.
* Testing Library for component behavior.
* Playwright for critical end-to-end flows.
* Local storage through a versioned repository abstraction.
* MiniSearch or an equivalent lightweight local search index.
* Cloudflare Workers AI as the default hosted AI provider.
* Ollama as the local development provider.
* No vector database in the MVP.
* No authentication in the MVP.
* No paid database in the MVP.

The application must work without an AI provider through a guided form fallback.

---

## 5. Dataset Integration

Do not depend on the GitHub repository at runtime.

Create scripts that:

1. Import a pinned version of `data/exercises.json`.
2. Validate it against the source JSON Schema.
3. Normalize whitespace and category names.
4. Preserve original IDs.
5. Generate a compact application catalog.
6. Generate indexes for equipment, body part, target and secondary muscles.
7. Produce a data audit report.
8. Fail the build when IDs are duplicated or required fields are missing.

Suggested generated files:

```text
src/data/generated/exercises.compact.json
src/data/generated/exercise-index.json
src/data/generated/dataset-report.json
```

Preserve the raw imported dataset separately:

```text
src/data/source/exercises.json
src/data/source/exercises.schema.json
```

Never modify source records directly.

Application-specific corrections and enrichments belong in:

```text
src/data/curated/exercise-metadata.json
src/data/curated/exercise-aliases.json
src/data/curated/exercise-exclusions.json
```

Only exercises with reviewed curated metadata may participate in automatic routine generation.

Unreviewed exercises may still appear in the catalog explorer with a visible “Sin revisar para rutinas automáticas” state.

---

## 6. Media Policy

Do not copy or deploy the source repository's images or GIFs in the MVP.

Use:

* Original local SVG illustrations.
* Abstract anatomical silhouettes.
* Equipment pictograms.
* Neutral placeholders.
* CSS-generated movement diagrams where appropriate.

Create:

```text
docs/DATA_ATTRIBUTIONS.md
docs/MEDIA_POLICY.md
docs/ASSET_REPLACEMENT.md
```

The source dataset's textual license and the separate media restrictions must be documented.

No agent may silently download or redistribute third-party exercise media.

---

## 7. Domain Models

### 7.1 Routine Request

```ts
type RoutineGoal =
  | "hypertrophy"
  | "strength"
  | "general_fitness"
  | "muscular_endurance";

type ExperienceLevel =
  | "beginner"
  | "intermediate"
  | "advanced";

type RoutineRequest = {
  goal: RoutineGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  availableEquipment: string[];
  trainingLocation: "commercial_gym" | "home" | "custom";
  focusMuscles: string[];
  excludedExercises: string[];
  excludedMovementPatterns: string[];
  preferredExercises: string[];
  limitations: string[];
  notes: string | null;
};
```

Required before generation:

* Goal.
* Experience.
* Days per week.
* Session duration.
* Available equipment or training location.
* Confirmation of current limitations or injuries.

The chat should ask only for missing required fields.

### 7.2 Exercise Metadata

```ts
type ExerciseMetadata = {
  exerciseId: string;
  approvedForGeneration: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  movementPattern:
    | "horizontal_push"
    | "vertical_push"
    | "horizontal_pull"
    | "vertical_pull"
    | "squat"
    | "hinge"
    | "lunge"
    | "carry"
    | "core"
    | "isolation"
    | "cardio";
  modality: "compound" | "isolation";
  laterality: "bilateral" | "unilateral";
  defaultRepRange: [number, number];
  defaultRestSeconds: [number, number];
  fatigueCost: "low" | "medium" | "high";
  skillRequirement: "low" | "medium" | "high";
  substitutionGroup: string;
  tags: string[];
};
```

### 7.3 Routine Plan

```ts
type RoutineExercise = {
  exerciseId: string;
  sets: number;
  repPrescription: string;
  restSeconds: number;
  rir: number | null;
  tempo: string | null;
  notes: string[];
  selectionReasons: string[];
};

type RoutineDay = {
  id: string;
  name: string;
  focus: string[];
  estimatedMinutes: number;
  exercises: RoutineExercise[];
};

type RoutinePlan = {
  id: string;
  title: string;
  goal: RoutineGoal;
  daysPerWeek: number;
  summary: string;
  days: RoutineDay[];
  warnings: string[];
  assumptions: string[];
  generatedAt: string;
  engineVersion: string;
  datasetVersion: string;
};
```

---

## 8. Routine Construction Rules

Implement routine generation with deterministic templates.

Initial supported splits:

```text
1 day  → Full Body
2 days → Full Body A/B
3 days → Full Body or Push/Pull/Legs
4 days → Upper/Lower or Torso/Limbs
5 days → Upper/Lower/Push/Pull/Legs
6 days → Push/Pull/Legs repeated
```

The engine must select a split based on:

* Goal.
* Experience.
* Days available.
* Session duration.
* Muscle priorities.
* Equipment.
* User exclusions.

The engine should:

1. Select primary compound movements first.
2. Add secondary compound movements.
3. Add isolation work only after movement requirements are satisfied.
4. Avoid placing multiple high-fatigue exercises together without reason.
5. Prefer low-skill alternatives for beginners.
6. Avoid unnecessary exercise variety.
7. Avoid selecting near-identical movements in the same session.
8. Respect recovery between repeated muscle-group sessions.
9. Estimate session length from sets and rest time.
10. Remove lower-priority exercises when the session exceeds its duration limit.
11. Record a reason for every selection.
12. Produce multiple valid substitutions for every exercise.

Programming constants must live in versioned configuration files, not inside prompts or React components.

Suggested files:

```text
src/domain/routine/config/volume-rules.ts
src/domain/routine/config/split-templates.ts
src/domain/routine/config/session-time.ts
src/domain/routine/config/exercise-priorities.ts
```

---

## 9. AI Provider Contract

Create an AI-provider abstraction.

```ts
interface AiProvider {
  parseRoutineRequest(input: ParseRoutineInput): Promise<ParseRoutineResult>;
  classifySafety(input: string): Promise<SafetyClassification>;
  explainPlan(input: ExplainPlanInput): Promise<string>;
}
```

Required implementations:

```text
CloudflareAiProvider
OllamaAiProvider
MockAiProvider
```

The AI parser must produce structured output validated with Zod.

On invalid output:

1. Attempt one schema-repair request.
2. Validate again.
3. Fall back to the guided form.
4. Never continue with partially trusted fields.

API credentials must never reach the browser.

Implement rate limiting, request-size limits and timeout handling.

The AI provider must receive:

* The user's message.
* Current structured conversation state.
* Allowed enum values.
* Required schema.
* Safety instructions.

It must not receive:

* The entire exercise catalog.
* Private environment variables.
* Unnecessary conversation history.
* Unvalidated HTML.
* Application secrets.

---

## 10. Retrieval and Exercise Questions

Routine generation uses deterministic filtering.

General exercise questions may use local retrieval.

Example:

> “¿Qué ejercicios con mancuerna trabajan el pecho?”

Flow:

1. Normalize the query.
2. Apply Spanish-English aliases.
3. Search the compact local index.
4. Retrieve at most 8 relevant exercises.
5. Present the exact matching records.
6. Optionally ask the AI provider to summarize only those retrieved records.

The answer must identify which information comes from the dataset.

The AI may not cite exercises that were not retrieved.

---

## 11. Safety Boundaries

The application is an educational fitness-planning tool, not a medical service.

Before routine generation, ask whether the user currently has:

* Pain during movement.
* A recent injury.
* A recent operation.
* A medical restriction.
* Symptoms that appear during exercise.
* Instructions from a healthcare professional that affect training.

When an acute or medically complex situation is detected:

* Do not generate a personalized routine.
* Do not diagnose.
* Do not suggest rehabilitation movements.
* Explain that professional assessment may be appropriate.
* Allow the user to browse the exercise catalog without personalized recommendations.

Unsupported MVP populations and requests:

* Rehabilitation.
* Acute injuries.
* Postoperative training.
* Pregnancy-specific programming.
* Programs for minors.
* Complex medical conditions.
* Medication or supplement recommendations.
* Eating-disorder-related requests.
* Extreme rapid-weight-loss routines.

All safety decisions must be represented as structured rules and tested.

---

## 12. Product Screens

### 12.1 Landing

Must communicate:

* Describe how you want to train.
* Receive a structured routine.
* Every exercise comes from a verified catalog.
* The plan remains editable.

Primary action:

```text
Crear mi rutina
```

Secondary action:

```text
Explorar ejercicios
```

### 12.2 Guided Setup

Collect:

* Main goal.
* Experience.
* Days per week.
* Session duration.
* Training location.
* Available equipment.
* Priority muscles.
* Exercises to avoid.
* Current limitations.

The user can complete this through chat, controls or a mixture of both.

### 12.3 Routine Chat

Include:

* Conversation thread.
* Prompt suggestions.
* Structured profile summary.
* Visible missing-information indicators.
* Streaming state.
* AI-provider unavailable state.
* Free-quota-exhausted state.
* Guided-form fallback.

### 12.4 Generated Routine

Display:

* Weekly split.
* Days as tabs or cards.
* Estimated duration.
* Muscle focus.
* Exercises in order.
* Sets.
* Repetitions.
* Rest.
* RIR or effort guidance.
* Selection reasons.
* Warnings and assumptions.

Actions:

* Replace exercise.
* Remove exercise.
* Reorder exercise.
* Adjust sets.
* Save routine.
* Duplicate routine.
* Regenerate one day.
* Return to chat.

Replacing one exercise must not regenerate the entire routine.

### 12.5 Exercise Detail

Display:

* Exercise name.
* Target.
* Secondary muscles.
* Equipment.
* Spanish instructions.
* Movement pattern.
* Difficulty.
* Routine placement.
* Approved substitutions.
* Dataset attribution.

### 12.6 Exercise Explorer

Support:

* Text search.
* Muscle filters.
* Equipment filters.
* Movement-pattern filters.
* Approved-only filter.
* Exercise detail drawer.
* Add-to-routine action.

### 12.7 Saved Routines

Persist locally:

* Routine name.
* Goal.
* Weekly split.
* Last update.
* Dataset version.
* Engine version.

Use versioned migrations for local persistence.

---

## 13. Offline and Failure Behavior

The catalog, routine engine and guided routine builder must work without an AI connection.

When AI is unavailable:

* Preserve current answers.
* Display a clear status.
* Continue through structured controls.
* Generate the same deterministic routine after required fields are complete.

The application must never display a blank page because an AI request failed.

Required failure states:

* Provider unavailable.
* Provider timeout.
* Invalid structured output.
* Daily quota exhausted.
* Dataset validation failure.
* No exercise matches all constraints.
* Local-storage migration failure.
* Unsupported browser feature.

---

## 14. Accessibility and Responsive Behavior

Requirements:

* Mobile-first.
* Full keyboard navigation.
* Visible focus states.
* Correct labels and descriptions.
* No color-only status indicators.
* Reduced-motion support.
* Appropriate contrast.
* Accessible dialogs and drawers.
* Screen-reader announcements for generation status.
* Touch targets suitable for mobile use.
* No essential hover-only interaction.

---

## 15. Testing

### Unit Tests

Cover:

* Dataset normalization.
* Alias resolution.
* Equipment filtering.
* Split selection.
* Candidate scoring.
* Volume calculations.
* Session-time estimation.
* Substitution selection.
* Safety classification rules.
* Final-plan validation.
* Local-storage migrations.

### Contract Tests

Each AI provider must pass the same contract suite.

Test prompts in Spanish:

```text
“Quiero entrenar cuatro días para ganar músculo.”
“Sólo tengo dos mancuernas.”
“No puedo hacer sentadilla.”
“Quiero entrenar pecho todos los días.”
“Me lesioné ayer, armame una rutina.”
“Quiero entrenar tres veces por semana durante cuarenta minutos.”
```

### Property Tests

For every generated plan:

* All IDs exist.
* Every exercise is approved.
* No excluded equipment appears.
* No excluded movement appears.
* Days equal the requested frequency.
* Sets and rest values are within valid ranges.
* Estimated time remains within configured tolerance.

### End-to-End Tests

Required flows:

1. Complete onboarding and generate a routine.
2. Generate through natural-language chat.
3. Continue through guided fallback when AI fails.
4. Replace one exercise.
5. Save and reopen a routine.
6. Block an unsupported medical request.
7. Browse and filter exercises.
8. Use the application on a mobile viewport.

---

## 16. Repository Structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── crear/
│   ├── rutina/
│   ├── ejercicios/
│   ├── guardadas/
│   └── api/
│       └── ai/
├── components/
│   ├── chat/
│   ├── routine/
│   ├── exercise/
│   ├── onboarding/
│   └── ui/
├── ai/
│   ├── providers/
│   ├── prompts/
│   ├── schemas/
│   └── safety/
├── domain/
│   ├── exercises/
│   ├── routine/
│   │   ├── engine/
│   │   ├── validators/
│   │   ├── templates/
│   │   └── config/
│   └── profile/
├── data/
│   ├── source/
│   ├── curated/
│   └── generated/
├── persistence/
│   ├── repositories/
│   └── migrations/
└── test/
    ├── fixtures/
    ├── contracts/
    └── e2e/

scripts/
├── import-dataset.mjs
├── validate-dataset.mjs
├── build-catalog.mjs
└── audit-catalog.mjs

docs/
├── design-reference/
├── DATA_ATTRIBUTIONS.md
├── MEDIA_POLICY.md
├── DATASET_AUDIT.md
├── AI_ARCHITECTURE.md
├── ROUTINE_ENGINE.md
└── SAFETY_BOUNDARIES.md
```

---

## 17. Development Phases

### Phase 0 — Repository and Design Preservation

* Inspect the starting repository.
* Preserve the Stitch export under `docs/design-reference`. MOBILE FIRST WEB APP.
* Record design decisions.
* Configure strict TypeScript.
* Add validation scripts.
* Establish the final folder structure.
* Do not implement AI yet.

### Phase 1 — Dataset Pipeline

* Import pinned source data.
* Validate schema.
* Generate normalized catalog.
* Build aliases and indexes.
* Produce audit report.
* Exclude third-party media.
* Curate initial approved exercise set.

### Phase 2 — Routine Domain Engine

* Implement schemas.
* Implement split templates.
* Implement filtering and scoring.
* Implement time estimation.
* Implement substitutions.
* Implement validators.
* Achieve strong unit-test coverage.

### Phase 3 — Static Product Experience

* Build landing page.
* Build onboarding.
* Build exercise explorer.
* Build deterministic guided routine builder.
* Build generated-plan editor.
* Add local persistence.

The application must already be useful at the end of this phase without AI.

### Phase 4 — AI Interpretation

* Add provider interface.
* Add mock provider.
* Add Ollama provider.
* Add Cloudflare provider.
* Add structured parsing.
* Add repair and fallback behavior.
* Add rate limiting and errors.

### Phase 5 — Polish

* Streaming chat presentation.
* Explanations.
* Micro-interactions.
* Empty states.
* Responsive audit.
* Accessibility audit.
* Performance optimization.
* Full E2E suite.

---

## 18. Definition of Done

The MVP is complete only when:

* The application works in Spanish.
* The dataset is imported and validated locally.
* Third-party exercise media is not redistributed.
* At least 100 common exercises have reviewed metadata.
* The guided form can generate routines without AI.
* Natural-language requests can be parsed through the AI-provider abstraction.
* AI output is schema-validated.
* Every generated exercise exists in the catalog.
* Every plan passes deterministic validation.
* The user can replace and reorder individual exercises.
* Routines persist locally.
* Safety boundaries are implemented and tested.
* AI failures have usable fallbacks.
* Mobile and desktop layouts are complete.
* Critical flows pass Playwright tests.
* `npm run validate` executes typecheck, lint, tests and build successfully.

---

## 19. Explicit Non-goals

Do not add during the MVP:

* Fine-tuning.
* A vector database.
* Authentication.
* Social features.
* Payments.
* Public profiles.
* Nutrition planning.
* Supplement recommendations.
* Medical rehabilitation.
* Camera-based exercise recognition.
* Automatic weight recommendations.
* Wearable integrations.
* Cloud synchronization.
* Full workout logging.
* One-repetition maximum testing.
* Unlicensed exercise GIFs or images.

These may be evaluated only after the core generation engine is reliable.
