# GOAL — FORMA

## 1. Mission

Build a polished, production-quality Spanish-language web application that allows users to describe the workout routine they need in natural language and receive a structured, explainable and editable training plan.

The application must use the `hasaneyldrm/exercises-dataset` GitHub repository as its source exercise catalog.

The project will use:

* Exercise metadata from the repository.
* Spanish exercise instructions from the repository.
* Exercise images and animated media included in the repository.
* A deterministic workout-programming engine.
* A small local language model through Ollama during development.
* Cloudflare Workers AI for the publicly deployed application.
* A guided form fallback that works without any language model.

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
4. Select only exercises that exist in the imported dataset.
5. Construct a balanced routine using deterministic programming rules.
6. Validate the complete routine.
7. Show the routine in a clear weekly format.
8. Display the real exercise image or animation when available.
9. Allow the user to inspect, replace, reorder and remove exercises.
10. Save the resulting routine locally.
11. Explain why each exercise and training day was selected.
12. Continue working through a guided form if the AI provider is unavailable.

---

## 3. Product Language

The product interface must be written primarily in Spanish.

Use simple and natural Spanish copy.

Examples:

```text
Contá cómo querés entrenar.
```

```text
Armame una rutina de cuatro días para ganar músculo.
```

```text
Para cerrar la rutina necesito saber cuánto tiempo tenés por sesión.
```

```text
Esta rutina fue validada usando ejercicios compatibles con tu equipamiento.
```

Internal source code, schemas, documentation and variable names may be written in English.

---

## 4. Fundamental Architecture

The application must be divided into independent layers.

```text
User message
    ↓
AI interpretation layer
    ↓
Validated RoutineRequest
    ↓
Deterministic routine engine
    ↓
Exercise catalog
    ↓
Routine validator
    ↓
Structured routine plan
    ↓
User interface
```

The language model must not be the source of truth.

The AI provider is responsible for understanding natural language.

The deterministic engine is responsible for building the workout.

The dataset is responsible for defining which exercises exist.

The validator is responsible for determining whether the result is acceptable.

---

## 5. Conversation Layer

The conversation layer is responsible for:

* Chat messages.
* Suggested prompts.
* Missing-information questions.
* Loading and generation states.
* Current user constraints.
* Presenting the final plan.
* Letting the user correct interpreted information.
* Switching to the guided form when AI is unavailable.

The conversation layer must not contain:

* Exercise-selection logic.
* Weekly-volume logic.
* Split-selection logic.
* Medical decision-making.
* Dataset validation logic.
* Provider-specific AI implementation details.

---

## 6. AI Interpretation Layer

The AI layer is responsible for:

* Parsing natural-language requests.
* Extracting workout preferences and restrictions.
* Producing a structured `RoutineRequest`.
* Identifying missing required information.
* Detecting unsupported or safety-sensitive requests.
* Producing optional explanations for an already validated plan.
* Interpreting follow-up changes such as:

```text
Cambiame el press inclinado por otro ejercicio.
```

```text
Quiero priorizar más la espalda.
```

```text
Necesito que cada sesión dure 45 minutos.
```

The AI layer must never:

* Invent exercise IDs.
* Directly create the authoritative final routine.
* Decide whether an exercise actually exists.
* Calculate final weekly volume.
* Calculate session duration.
* Bypass deterministic validators.
* Receive the entire raw exercise dataset in every request.
* Diagnose injuries or medical conditions.
* Create rehabilitation plans.
* Expose credentials to the browser.

---

## 7. AI Providers

Implement a provider-independent AI architecture.

```ts
interface AiProvider {
  parseRoutineRequest(
    input: ParseRoutineInput
  ): Promise<ParseRoutineResult>;

  parseRoutineModification(
    input: ParseRoutineModificationInput
  ): Promise<RoutineModificationResult>;

  classifySafety(
    input: SafetyClassificationInput
  ): Promise<SafetyClassification>;

  explainPlan(
    input: ExplainPlanInput
  ): Promise<string>;
}
```

Required implementations:

```text
OllamaAiProvider
CloudflareAiProvider
MockAiProvider
```

Provider selection must be controlled through environment configuration.

```env
AI_PROVIDER=ollama
```

Supported values:

```text
ollama
cloudflare
mock
disabled
```

The application must not depend directly on Ollama or Cloudflare outside the provider layer.

---

## 8. Ollama Local Development Provider

Use Ollama as the default AI provider during local development.

Default model:

```text
qwen3:1.7b
```

Default API URL:

```text
http://127.0.0.1:11434
```

Development environment:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

The application must connect to Ollama only through server-side code.

The browser must never call `localhost:11434` directly.

The provider must:

* Use Ollama structured outputs when supported.
* Provide the complete expected JSON Schema.
* Validate every response with Zod.
* Set request and response size limits.
* Set a timeout.
* Abort obsolete requests.
* Attempt one schema-repair request when output is invalid.
* Fall back to the guided form after repeated failure.
* Produce useful development logs without exposing private data.

Required local setup documentation:

```text
docs/LOCAL_AI_SETUP.md
```

The document must include:

```bash
ollama pull qwen3:1.7b
ollama run qwen3:1.7b
```

The application must show an understandable state when Ollama is not installed or not running:

```text
El asistente local no está disponible.

Podés iniciar Ollama o continuar con el formulario guiado.
```

The rest of the product must continue working without Ollama.

---

## 9. Cloudflare Workers AI Production Provider

Use Cloudflare Workers AI as the default hosted provider for the deployed application.

Default model:

```text
@cf/ibm-granite/granite-4.0-h-micro
```

Cloudflare configuration must use an AI binding.

Example `wrangler.jsonc` configuration:

```json
{
  "ai": {
    "binding": "AI"
  },
  "vars": {
    "AI_PROVIDER": "cloudflare",
    "CLOUDFLARE_AI_MODEL": "@cf/ibm-granite/granite-4.0-h-micro"
  }
}
```

The provider must execute the model through the server-side binding:

```ts
env.AI.run(modelName, request);
```

Do not:

* Send Cloudflare credentials to the browser.
* Call Cloudflare Workers AI directly from a Client Component.
* Store API secrets in public environment variables.
* Hardcode account credentials.
* Depend on a paid Cloudflare feature without documenting it.
* Assume that the free quota is unlimited.

The provider must handle:

* Provider unavailable.
* Request timeout.
* Invalid structured output.
* Rate limiting.
* Daily free quota exhausted.
* Unsupported model.
* Cloudflare binding missing.
* Internal provider errors.

When Cloudflare Workers AI is unavailable, display:

```text
El asistente conversacional no está disponible.

Tu información sigue guardada. Podés completar la rutina mediante el formulario y obtener el mismo plan estructurado.
```

The deterministic form and routine engine must continue working when the AI quota has been exhausted.

Required deployment documentation:

```text
docs/CLOUDFLARE_DEPLOYMENT.md
```

It must describe:

```bash
npm install --save-dev wrangler@latest
npx wrangler login
npx wrangler deploy
```

---

## 10. Mock and Disabled Providers

Implement `MockAiProvider` for:

* Automated tests.
* Storybook or isolated UI development.
* Deterministic demos.
* Local development without Ollama.

The mock provider must return predefined valid objects and configurable error states.

Support:

```env
AI_PROVIDER=disabled
```

When AI is disabled:

* Hide or disable the conversational interpretation feature.
* Preserve the visual chat experience where useful.
* Guide the user through deterministic controls.
* Keep exercise search and routine generation available.
* Never display a broken loading state.

---

## 11. Structured AI Output

All AI responses that influence application state must use structured output.

Example AI output:

```json
{
  "goal": "hypertrophy",
  "experience": "intermediate",
  "daysPerWeek": 4,
  "sessionMinutes": 60,
  "trainingLocation": "commercial_gym",
  "availableEquipment": ["dumbbell", "barbell", "cable", "machine"],
  "focusMuscles": ["back", "shoulders"],
  "excludedExercises": ["deadlift"],
  "excludedMovementPatterns": [],
  "preferredExercises": [],
  "limitations": [],
  "notes": null
}
```

The provider response must be parsed with Zod.

On invalid output:

1. Reject the response.
2. Request one schema repair.
3. Validate the repaired response.
4. Fall back to the guided form if it remains invalid.
5. Never use partially validated data.
6. Never silently ignore invalid fields.

Prompts must be stored in version-controlled files:

```text
src/ai/prompts/parse-routine-request.ts
src/ai/prompts/parse-routine-modification.ts
src/ai/prompts/classify-safety.ts
src/ai/prompts/explain-routine.ts
```

Prompts must not be embedded directly inside route handlers or React components.

---

## 12. AI Human Setup Requirements

The coding agent can implement the complete Ollama and Cloudflare integrations.

The human operator is responsible for:

### Local development

1. Install Ollama.
2. Download the configured model.
3. Keep Ollama running while using local AI.
4. Configure `.env.local`.

Example:

```env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:1.7b
```

### Cloudflare deployment

1. Create or use a Cloudflare account.
2. Run `npx wrangler login`.
3. Authorize Wrangler in the browser.
4. Review the generated Cloudflare configuration.
5. Run the deployment command.

The agent must automate everything else that can be safely automated.

The agent must not pretend that account creation, browser authorization or local application installation occurred automatically.

---

## 13. Technology

Use:

* Next.js 16.
* App Router.
* TypeScript strict mode.
* React Server Components by default.
* Client Components only when interaction requires them.
* Tailwind CSS.
* Zod.
* Vitest.
* Testing Library.
* Playwright.
* Local storage through a versioned persistence abstraction.
* MiniSearch, Fuse.js or an equivalent local search system.
* Ollama for local AI.
* Cloudflare Workers AI for production AI.
* Cloudflare Workers-compatible server-side APIs.
* No vector database in the MVP.
* No fine-tuning in the MVP.
* No authentication in the MVP.
* No paid database in the MVP.

The application must remain usable without any AI provider.

---

## 14. Dataset Source

Use:

```text
https://github.com/hasaneyldrm/exercises-dataset
```

Pin the imported dataset to a specific commit.

Do not depend on the GitHub repository at runtime for exercise metadata.

Create an import process that:

1. Retrieves or copies the pinned source dataset.
2. Validates the source JSON Schema.
3. Preserves original exercise IDs.
4. Normalizes whitespace and category values.
5. Resolves local media paths.
6. Generates a compact runtime catalog.
7. Generates indexes.
8. Produces an audit report.
9. Fails when structural errors are detected.

Suggested source files:

```text
src/data/source/exercises.json
src/data/source/exercises.schema.json
src/data/source/dataset-source.json
```

Suggested generated files:

```text
src/data/generated/exercises.compact.json
src/data/generated/exercise-index.json
src/data/generated/media-index.json
src/data/generated/dataset-report.json
```

The source records must remain immutable.

Application-specific enrichment must be stored separately:

```text
src/data/curated/exercise-metadata.json
src/data/curated/exercise-aliases.json
src/data/curated/exercise-exclusions.json
src/data/curated/exercise-media-overrides.json
```

---

## 15. Real Exercise Images and Videos

The product will use the real exercise images and animated media included in the source GitHub repository.

Media may include:

* Exercise thumbnails.
* Animated GIF demonstrations.
* Video or animation files present in the repository.
* Media identifiers referenced by dataset records.

Create a controlled media import process.

Do not request media directly from GitHub every time a user opens an exercise.

Copy imported media into a local or deployment-controlled directory:

```text
public/exercises/media/
```

Preserve:

* Original filenames.
* Original file extensions.
* Original exercise relationships.
* Original dimensions when possible.
* Original aspect ratios.
* Attribution metadata.

Generate a media manifest:

```text
src/data/generated/media-index.json
```

Example:

```json
{
  "exerciseId": "0001",
  "thumbnail": "/exercises/media/0001.png",
  "animation": "/exercises/media/0001.gif",
  "attribution": "© Gym Visual",
  "source": "hasaneyldrm/exercises-dataset",
  "available": true
}
```

The interface must support:

* Static thumbnail previews.
* Animated media in exercise details.
* User-controlled animation playback where possible.
* Lazy loading.
* Reduced-motion preferences.
* A placeholder when media is missing.
* A disabled-media mode.

Do not autoplay every GIF in a large exercise grid.

Exercise catalog cards should initially show:

* A static thumbnail.
* The first frame of the animation.
* A neutral placeholder.

Animation may start:

* When the exercise detail opens.
* When the user presses play.
* When the card becomes selected.
* When explicitly allowed by product configuration.

Respect `prefers-reduced-motion`.

For reduced-motion users:

* Do not autoplay animated demonstrations.
* Display the static image or first frame.
* Provide an explicit play action.

---

## 16. Media Feature Configuration

Control exercise media through environment variables.

```env
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=true
NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA=false
```

The application must work correctly when:

```env
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=false
```

When media is disabled:

* Show a local neutral placeholder.
* Keep exercise instructions available.
* Keep exercise selection available.
* Keep routine generation available.
* Do not break layouts.
* Do not show broken image elements.

Create a central media resolver:

```ts
interface ExerciseMediaResolver {
  getMedia(exerciseId: string): ExerciseMedia;
}
```

React components must not construct media paths manually.

---

## 17. Media Attribution and Legal Boundary

The repository's code and exercise metadata licensing must not be assumed to automatically cover all included media.

The imported images, GIFs and animations are associated with Gym Visual and must be treated as separately licensed media.

The application must:

* Preserve the repository's original notices.
* Preserve media attribution information.
* Display `© Gym Visual` in exercise details using that media.
* Include Gym Visual attribution on a global legal or attribution page.
* Include the source repository attribution.
* Document the exact imported dataset commit.
* Avoid implying that the media was created by FORMA.
* Avoid removing watermarks or embedded attribution.
* Avoid upscaling or generating higher-resolution copies from the source media.
* Avoid materially altering the original media.
* Avoid redistributing the media as a standalone downloadable package.

Create:

```text
docs/DATA_ATTRIBUTIONS.md
docs/MEDIA_LICENSE_REVIEW.md
docs/MEDIA_IMPORT.md
docs/ASSET_REPLACEMENT.md
```

The application may use repository media during local development and private evaluation.

Before a public production launch, the human operator must verify whether the intended public and commercial use requires authorization or an additional license from Gym Visual.

The agent must clearly mark this as a production-launch requirement.

The agent must not falsely state that the repository's MIT license grants unrestricted rights over the media.

Add a production readiness checklist item:

```text
[ ] Gym Visual media usage permission or licensing requirements reviewed.
```

If authorization cannot be confirmed, the media system must support replacing repository assets without changing exercise IDs or domain logic.

---

## 18. Media Performance Requirements

The media implementation must avoid excessive network and memory usage.

Requirements:

* Lazy-load off-screen images.
* Do not preload the complete media catalog.
* Do not animate all exercise cards simultaneously.
* Use fixed dimensions to prevent layout shifts.
* Use caching headers for immutable imported assets.
* Load full animation only in detail views when possible.
* Use a static thumbnail in search results.
* Limit active animations.
* Cancel or pause animation when a detail view closes.
* Preserve acceptable performance on mobile connections.

The initial landing page must not load the complete exercise media directory.

---

## 19. Dataset Enrichment

The source dataset is primarily an exercise catalog.

It must be enriched with application-specific programming metadata.

```ts
type ExerciseMetadata = {
  exerciseId: string;
  approvedForGeneration: boolean;

  difficulty:
    | "beginner"
    | "intermediate"
    | "advanced";

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

  modality:
    | "compound"
    | "isolation";

  laterality:
    | "bilateral"
    | "unilateral";

  defaultRepRange: [number, number];
  defaultRestSeconds: [number, number];

  fatigueCost:
    | "low"
    | "medium"
    | "high";

  skillRequirement:
    | "low"
    | "medium"
    | "high";

  substitutionGroup: string;
  tags: string[];
};
```

Do not automatically use every imported exercise in generated routines.

Only exercises satisfying all conditions may participate:

```text
Source exercise exists
AND normalized exercise exists
AND curated metadata exists
AND approvedForGeneration is true
```

Unreviewed exercises may appear in the explorer with:

```text
Todavía no revisado para rutinas automáticas
```

Start by curating approximately 100–200 common exercises.

Prioritize:

* Common commercial-gym exercises.
* Common dumbbell exercises.
* Common barbell exercises.
* Cable exercises.
* Machine exercises.
* Bodyweight exercises.
* Exercises with understandable instructions.
* Exercises with valid media.
* Exercises with clear substitution groups.

---

## 20. Routine Request Domain Model

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

type TrainingLocation =
  | "commercial_gym"
  | "home"
  | "custom";

type RoutineRequest = {
  goal: RoutineGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;

  trainingLocation: TrainingLocation;
  availableEquipment: string[];

  focusMuscles: string[];
  excludedExercises: string[];
  excludedMovementPatterns: string[];
  preferredExercises: string[];

  limitations: string[];
  notes: string | null;
};
```

Required before routine generation:

* Goal.
* Experience.
* Days per week.
* Session duration.
* Training location or equipment.
* Current physical limitations confirmation.

The conversation should ask only for missing required fields.

Every AI-inferred field must remain editable.

---

## 21. Routine Plan Domain Model

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
  seed: string;
};
```

The complete routine must be reproducible from:

```text
RoutineRequest
datasetVersion
engineVersion
seed
```

---

## 22. Deterministic Routine Engine

The routine engine is authoritative.

It must not call an AI model while selecting exercises.

The engine is responsible for:

* Choosing a weekly split.
* Building exercise candidate pools.
* Filtering by equipment.
* Filtering excluded exercises.
* Filtering excluded movement patterns.
* Prioritizing requested muscles.
* Scoring eligible exercises.
* Selecting exercises.
* Assigning sets and repetitions.
* Assigning rest.
* Estimating session duration.
* Balancing weekly volume.
* Avoiding accidental duplicates.
* Selecting substitutions.
* Producing selection reasons.
* Validating the completed plan.

Required pure functions:

```text
chooseSplit
buildCandidatePool
scoreExercise
selectExercises
assignPrescription
estimateSessionDuration
calculateWeeklyVolume
findSubstitutions
validateRoutine
```

Programming rules must live in versioned configuration files.

```text
src/domain/routine/config/split-templates.ts
src/domain/routine/config/volume-rules.ts
src/domain/routine/config/session-time.ts
src/domain/routine/config/exercise-priorities.ts
src/domain/routine/config/rep-rules.ts
```

Do not store workout-programming rules inside prompts.

---

## 23. Initial Weekly Split Support

Initial supported templates:

```text
1 day  → Full Body
2 days → Full Body A/B
3 days → Full Body or Push/Pull/Legs
4 days → Upper/Lower or Torso/Limbs
5 days → Upper/Lower/Push/Pull/Legs
6 days → Push/Pull/Legs repeated
```

The selected split must consider:

* Goal.
* Experience.
* Days per week.
* Session duration.
* Muscle priorities.
* Equipment.
* User exclusions.
* Recovery requirements.

The engine should:

1. Select primary compound movements first.
2. Add secondary compound movements.
3. Add isolation movements afterward.
4. Prefer lower-skill alternatives for beginners.
5. Avoid unnecessary variety.
6. Avoid near-identical exercises in one session.
7. Avoid excessive high-fatigue movements in one session.
8. Respect the requested session duration.
9. Remove lower-priority work if the routine is too long.
10. Produce alternatives for each exercise.
11. Record why each exercise was selected.

---

## 24. Routine Validation

No routine may be presented as completed before passing validation.

Validate:

* Every exercise ID exists.
* Every exercise is approved for generation.
* Every exercise has valid metadata.
* Every exercise has compatible equipment.
* No excluded exercise appears.
* No excluded movement pattern appears.
* Number of days matches the request.
* Set counts are within configured ranges.
* Repetition prescriptions are valid.
* Rest times are valid.
* Session duration is within tolerance.
* Weekly volume is within configured limits.
* Movement patterns are reasonably balanced.
* Muscle recovery is reasonable.
* Exact exercises are not duplicated accidentally.
* Required fields are present.
* Unsupported medical requests were not accepted.

When validation fails:

* Do not show the plan as ready.
* Attempt deterministic correction.
* Record which rule failed.
* Preserve the user's request.
* Show a useful error if no valid routine can be produced.

---

## 25. Exercise Search and Retrieval

Do not introduce a vector database in the MVP.

Use:

* Structured filters.
* Local text search.
* Spanish-English aliases.
* Muscle aliases.
* Equipment aliases.
* Movement-pattern aliases.
* Exact exercise IDs.

Example alias file:

```json
{
  "pecho": ["chest", "pectorals", "pectoralis major"],
  "espalda": ["back", "lats", "latissimus dorsi"],
  "mancuerna": ["dumbbell"],
  "mancuernas": ["dumbbell"],
  "polea": ["cable"],
  "peso corporal": ["body weight"]
}
```

For exercise questions:

```text
¿Qué ejercicios con mancuerna trabajan el pecho?
```

The application must:

1. Normalize the query.
2. Resolve aliases.
3. Search the local catalog.
4. Retrieve a limited number of matching records.
5. Answer using only retrieved records.
6. Display dataset media when available.
7. Avoid mentioning exercises that were not retrieved.

AI may summarize retrieved records, but it must not invent additional exercises.

---

## 26. Safety Boundaries

FORMA is an educational fitness-planning tool.

It is not:

* A medical service.
* A rehabilitation service.
* A diagnostic tool.
* A substitute for a healthcare professional.
* A replacement for an in-person trainer when supervision is required.

Before generating a personalized routine, ask whether the user currently has:

* Pain during movement.
* A recent injury.
* A recent operation.
* A medical restriction.
* Symptoms during exercise.
* Professional instructions that affect training.

Unsupported MVP requests:

* Acute-injury programming.
* Rehabilitation.
* Postoperative routines.
* Diagnosis.
* Pregnancy-specific programming.
* Routines for minors.
* Complex medical-condition programming.
* Medication advice.
* Supplement prescriptions.
* Extreme rapid-weight-loss routines.
* Eating-disorder-related requests.

When a safety-sensitive request is detected:

* Do not produce a personalized routine.
* Do not diagnose.
* Do not recommend rehabilitation exercises.
* Explain the limitation clearly.
* Preserve the user's data.
* Allow exercise browsing.
* Allow the user to edit restrictions.

Example:

```text
Este pedido necesita más cuidado.

FORMA no puede evaluar lesiones ni reemplazar una indicación profesional. Podés seguir explorando ejercicios o crear una rutina cuando tengas indicaciones claras sobre qué movimientos evitar.
```

Safety classification must not rely exclusively on the AI provider.

Implement deterministic keyword and state-based safety checks in addition to AI classification.

---

## 27. Product Screens

### 27.1 Landing Page

Include:

* Product value proposition.
* Natural-language prompt examples.
* Routine preview.
* Verified exercise catalog messaging.
* Real exercise media preview.
* Primary action:

```text
Crear mi rutina
```

* Secondary action:

```text
Explorar ejercicios
```

### 27.2 Routine Setup

Collect:

* Goal.
* Experience.
* Days per week.
* Session duration.
* Training location.
* Equipment.
* Priority muscles.
* Exercises to avoid.
* Current limitations.

Allow chat, form controls or a mixture of both.

### 27.3 Routine Chat

Include:

* Conversation thread.
* Suggested prompts.
* Structured profile summary.
* Missing-information indicators.
* Provider loading state.
* Ollama unavailable state.
* Cloudflare unavailable state.
* Cloudflare quota state.
* Invalid AI output state.
* Guided-form fallback.

### 27.4 Guided Form

The form must produce the same `RoutineRequest` as chat.

Steps:

1. Goal.
2. Experience.
3. Availability.
4. Equipment.
5. Muscle priorities.
6. Restrictions.
7. Review.

### 27.5 Routine Generation State

Display stages:

```text
Interpretando tu pedido
Buscando ejercicios compatibles
Distribuyendo el volumen
Validando la rutina
```

Do not use a generic spinner as the only feedback.

### 27.6 Generated Routine

Show:

* Routine title.
* Goal.
* Weekly split.
* Estimated duration.
* Training days.
* Exercises.
* Real exercise thumbnail.
* Sets and repetitions.
* Rest.
* RIR or effort guidance.
* Selection reasons.
* Assumptions.
* Warnings.
* Validation status.

Actions:

* View exercise.
* Play exercise demonstration.
* Replace exercise.
* Edit sets.
* Remove exercise.
* Reorder exercise.
* Save routine.
* Duplicate routine.
* Regenerate one day.
* Return to chat.

Replacing one exercise must not regenerate unaffected exercises or days.

### 27.7 Exercise Detail

Show:

* Exercise name.
* Real image.
* Real animated demonstration when available.
* Media attribution.
* Primary muscle.
* Secondary muscles.
* Equipment.
* Body part.
* Movement pattern.
* Difficulty.
* Exercise type.
* Spanish instructions.
* Routine placement.
* Approved substitutions.
* Dataset attribution.

### 27.8 Exercise Explorer

Support:

* Text search.
* Muscle filter.
* Body-part filter.
* Equipment filter.
* Pattern filter.
* Difficulty filter.
* Approved-only filter.
* Media-available filter.

Use static thumbnails in large grids.

Do not animate every result simultaneously.

### 27.9 Saved Routines

Persist locally:

* Routine name.
* Goal.
* Weekly split.
* Last update.
* Dataset version.
* Engine version.
* User modifications.

### 27.10 AI Failure State

Provide:

* Explanation.
* Retry action.
* Guided-form action.
* Preserved user information.
* No blank screen.
* No lost conversation state.

### 27.11 Safety State

Provide:

* Serious but calm visual language.
* Clear limitation.
* Exercise explorer action.
* Edit-restrictions action.
* No alarming medical claims.

---

## 28. Local Persistence

Use local storage for the MVP through a repository abstraction.

Do not access `localStorage` directly throughout UI components.

Create:

```ts
interface RoutineRepository {
  list(): Promise<RoutinePlan[]>;
  get(id: string): Promise<RoutinePlan | null>;
  save(plan: RoutinePlan): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}
```

Persist:

* Saved routines.
* Current routine draft.
* Current setup answers.
* Conversation-derived structured state.
* User media playback preference.
* Schema version.

Implement migrations.

The user must be able to delete locally saved data.

---

## 29. Accessibility

Requirements:

* Mobile-first.
* Keyboard navigation.
* Visible focus states.
* Correct labels.
* Screen-reader announcements.
* Accessible drawers and dialogs.
* Large touch targets.
* Reduced-motion support.
* No color-only indicators.
* No hover-only essential actions.
* Meaningful media alternative text.
* Static media fallback.
* User-controlled animation playback.

Exercise media alt text should describe the purpose without overstating accuracy.

Example:

```text
Demostración visual del press inclinado con mancuernas.
```

---

## 30. Responsive Behavior

Desktop:

* Structured multi-column workspace.
* Chat with contextual sidebars.
* Weekly routine overview.
* Exercise detail drawer.

Mobile:

* Conversation as the primary surface.
* Profile in a bottom sheet.
* Routine days as tabs or stacked cards.
* Exercise detail in a full-height sheet.
* Bottom navigation.
* Media fitted to the viewport.
* No horizontal overflow.

---

## 31. Performance

Requirements:

* Do not load the full exercise catalog on the landing page.
* Do not load every exercise animation initially.
* Lazy-load explorer results.
* Load static thumbnails before animations.
* Avoid unnecessary Client Components.
* Memoize search indexes.
* Debounce search.
* Keep AI calls server-side.
* Prevent duplicate provider requests.
* Cancel obsolete requests.
* Cache immutable generated catalog files.
* Use stable dimensions for exercise media.
* Avoid large layout shifts.
* Keep the guided builder fast without AI.

---

## 32. Security

Requirements:

* Validate all server inputs.
* Limit message length.
* Limit AI response length.
* Set provider timeouts.
* Rate-limit public AI endpoints.
* Do not expose secrets.
* Do not expose Cloudflare bindings.
* Do not execute model-generated code.
* Treat model output as untrusted.
* Escape rendered user content.
* Prevent prompt content from changing system-level constraints.
* Do not let uploaded or dataset text override safety instructions.
* Do not allow arbitrary local file access.
* Do not permit arbitrary remote media URLs.

---

## 33. Testing

### Unit Tests

Cover:

* Dataset normalization.
* Dataset schema validation.
* Media manifest generation.
* Missing-media fallback.
* Alias resolution.
* Search.
* Equipment filtering.
* Split selection.
* Candidate scoring.
* Exercise selection.
* Volume calculations.
* Session-time estimation.
* Substitution selection.
* Routine validation.
* Safety rules.
* Local-storage migrations.
* Provider output parsing.

### Provider Contract Tests

Every AI provider must pass the same behavioral contract.

Test prompts:

```text
Quiero entrenar cuatro días para ganar músculo.
```

```text
Sólo tengo dos mancuernas.
```

```text
No quiero hacer peso muerto.
```

```text
Quiero entrenar pecho todos los días.
```

```text
Me lesioné ayer, armame una rutina.
```

```text
Quiero entrenar tres veces por semana durante cuarenta minutos.
```

Test:

* Valid structured output.
* Missing-information detection.
* Invalid output repair.
* Timeout.
* Provider unavailable.
* Quota exhaustion.
* Guided-form fallback.

### Property Tests

For every generated routine:

* All exercise IDs exist.
* Every exercise is approved.
* Equipment matches.
* Excluded exercises do not appear.
* Excluded patterns do not appear.
* Number of days is correct.
* Sets are valid.
* Rest values are valid.
* Estimated duration is within tolerance.
* Routine validation passes.

### End-to-End Tests

Required flows:

1. Generate a routine through chat with Mock AI.
2. Generate through Ollama when locally enabled.
3. Generate through the guided form without AI.
4. Handle provider failure.
5. Replace one exercise.
6. Open real exercise media.
7. Disable animated media through reduced-motion preference.
8. Save and reopen a routine.
9. Block an unsupported medical request.
10. Browse and filter exercises.
11. Use the complete application on mobile.
12. Handle missing media without broken layout.

Cloudflare integration tests must be optional locally and must not consume paid usage during the standard test suite.

---

## 34. Dataset and Media Audit

Generate:

```text
docs/DATASET_AUDIT.md
```

Include:

* Dataset commit.
* Total exercises.
* Duplicate IDs.
* Missing required fields.
* Available languages.
* Equipment values.
* Body-part values.
* Target-muscle values.
* Exercises with Spanish instructions.
* Exercises without Spanish instructions.
* Approved exercise count.
* Unreviewed exercise count.
* Excluded exercise count.
* Media file count.
* Exercises with thumbnails.
* Exercises with animations.
* Exercises with missing media.
* Broken media references.
* Duplicate media references.
* Attribution values.
* Imported media size.

The build must fail on:

* Duplicate exercise IDs.
* Invalid required fields.
* Invalid curated references.
* Curated IDs that do not exist.
* Broken approved substitution groups.
* Unsafe generated public media paths.

Missing optional media must not fail the build.

---

## 35. Repository Structure

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
│   ├── media/
│   ├── onboarding/
│   └── ui/
├── ai/
│   ├── providers/
│   │   ├── ollama-provider.ts
│   │   ├── cloudflare-provider.ts
│   │   ├── mock-provider.ts
│   │   └── provider-factory.ts
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
├── media/
│   ├── manifest/
│   ├── resolver/
│   └── placeholders/
├── persistence/
│   ├── repositories/
│   └── migrations/
└── test/
    ├── fixtures/
    ├── contracts/
    └── e2e/

public/
└── exercises/
    ├── media/
    └── placeholders/

scripts/
├── import-dataset.mjs
├── import-media.mjs
├── validate-dataset.mjs
├── validate-media.mjs
├── build-catalog.mjs
└── audit-catalog.mjs

docs/
├── design-reference/
├── DATA_ATTRIBUTIONS.md
├── DATASET_AUDIT.md
├── MEDIA_LICENSE_REVIEW.md
├── MEDIA_IMPORT.md
├── ASSET_REPLACEMENT.md
├── LOCAL_AI_SETUP.md
├── CLOUDFLARE_DEPLOYMENT.md
├── AI_ARCHITECTURE.md
├── ROUTINE_ENGINE.md
├── SAFETY_BOUNDARIES.md
├── IMPLEMENTATION_LOG.md
├── DECISIONS.md
└── KNOWN_LIMITATIONS.md
```

---

## 36. Development Phases

### Phase 0 — Repository and Design Preservation

* Inspect the repository.
* Preserve the Stitch export.
* Store it under `docs/design-reference`.
* Record visual decisions.
* Configure strict TypeScript.
* Create the final directory structure.
* Add validation scripts.
* Do not implement AI yet.

### Phase 1 — Dataset and Media Pipeline

* Pin the source repository commit.
* Import dataset JSON.
* Validate schema.
* Import repository media.
* Generate media manifest.
* Validate media references.
* Generate normalized catalog.
* Generate search indexes.
* Create attribution documents.
* Create dataset and media audits.
* Add media feature flags.

### Phase 2 — Curated Exercise Metadata

* Define enrichment schema.
* Create aliases.
* Curate the first 100–200 exercises.
* Mark approved exercises.
* Define movement patterns.
* Define substitution groups.
* Define default rep and rest ranges.
* Validate all curated references.

### Phase 3 — Routine Domain Engine

* Implement routine schemas.
* Implement split templates.
* Implement filtering.
* Implement candidate scoring.
* Implement deterministic selection.
* Implement prescriptions.
* Implement duration estimation.
* Implement substitutions.
* Implement validators.
* Add strong unit-test coverage.

### Phase 4 — Static Product Experience

* Build landing page.
* Build guided setup.
* Build exercise explorer.
* Build exercise details.
* Integrate real media.
* Build deterministic routine generation.
* Build routine editor.
* Add local persistence.

The product must already be useful without AI at the end of this phase.

### Phase 5 — AI Provider Abstraction

* Implement provider interface.
* Implement Mock provider.
* Implement provider factory.
* Add structured schemas.
* Add timeout handling.
* Add repair handling.
* Add deterministic fallback.
* Add provider contract tests.

### Phase 6 — Ollama

* Implement Ollama provider.
* Use `qwen3:1.7b`.
* Add structured output.
* Add local setup documentation.
* Add missing-Ollama UI state.
* Confirm all server-side boundaries.

### Phase 7 — Cloudflare Workers AI

* Configure Workers AI binding.
* Implement Cloudflare provider.
* Use the configured small model.
* Add rate limiting.
* Add quota handling.
* Add deployment documentation.
* Confirm credentials never reach the browser.

### Phase 8 — Conversational Experience

* Connect chat to structured profile state.
* Ask only for missing fields.
* Support follow-up modifications.
* Add streaming presentation where supported.
* Add explanation generation.
* Preserve state during provider errors.

### Phase 9 — Production Polish

* Responsive audit.
* Accessibility audit.
* Reduced-motion audit.
* Media performance audit.
* Security audit.
* Full Playwright suite.
* Cloudflare deployment test.
* Legal and attribution review.
* Production readiness checklist.

---

## 37. Validation Command

Provide one primary command:

```bash
npm run validate
```

It must execute:

```text
dataset validation
media validation
curated metadata validation
typecheck
lint
unit tests
integration tests
production build
```

Optional external-provider tests must use separate commands:

```bash
npm run test:ollama
npm run test:cloudflare
```

Standard validation must not require:

* Ollama to be running.
* Cloudflare credentials.
* Internet access.
* Paid AI inference.

---

## 38. Definition of Done

The MVP is complete only when:

* The interface is complete in Spanish.
* The source dataset is pinned and imported locally.
* Dataset records pass schema validation.
* Real repository images and animations are integrated.
* Missing media has a valid fallback.
* Media attribution is visible.
* Media usage requirements are documented.
* Public production licensing review is explicitly pending or completed.
* At least 100 common exercises have reviewed metadata.
* The deterministic form can build routines without AI.
* Ollama can interpret natural-language requests locally.
* Cloudflare Workers AI can interpret requests in production.
* AI output is validated with Zod.
* AI failures preserve user progress.
* The free-quota failure state works.
* Every generated exercise exists in the catalog.
* Every generated exercise is approved.
* Every routine passes deterministic validation.
* The user can inspect real exercise media.
* The user can replace and reorder exercises.
* Replacing one exercise does not regenerate the full plan.
* Saved routines persist locally.
* Safety boundaries are implemented.
* Mobile and desktop layouts are complete.
* Reduced-motion behavior is correct.
* Critical Playwright flows pass.
* `npm run validate` succeeds.
* Local Ollama setup is documented.
* Cloudflare deployment is documented.
* Secrets and bindings remain server-side.

---

## 39. Production Readiness Checklist

```text
[ ] Dataset source commit pinned.
[ ] Source license and notices preserved.
[ ] Gym Visual media usage requirements reviewed.
[ ] Public or commercial media permission confirmed when required.
[ ] Media attribution visible in the application.
[ ] Cloudflare account connected.
[ ] Workers AI binding configured.
[ ] Cloudflare usage limits reviewed.
[ ] AI failure fallback tested.
[ ] Rate limiting enabled.
[ ] Safety behavior tested.
[ ] Accessibility audit completed.
[ ] Responsive audit completed.
[ ] Security audit completed.
[ ] Privacy and legal pages reviewed.
[ ] Production build validated.
```

---

## 40. Explicit Non-goals

Do not add during the MVP:

* Fine-tuning.
* Training a custom neural network.
* A vector database.
* Authentication.
* Social features.
* Payments.
* Public profiles.
* Nutrition planning.
* Supplement recommendations.
* Medical rehabilitation.
* Camera-based exercise recognition.
* Automatic weight prescriptions.
* Wearable integrations.
* Cloud synchronization.
* Workout-history analytics.
* One-repetition maximum testing.
* Public exercise-media downloads.
* Uncontrolled scraping of external fitness sites.
* Model-generated exercises not present in the dataset.

These features may only be evaluated after the deterministic routine engine is reliable.
