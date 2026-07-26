"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { generateRoutineUseCase } from "@/application/routines";
import type {
  CatalogExercise,
  MovementPattern,
} from "@/domain/exercises/catalog-exercise";
import {
  RoutineRequestSchema,
  type ExperienceLevel,
  type RoutineGoal,
  type RoutineRequest,
  type TrainingLocation,
} from "@/domain/profile/routine-request";
import { createRoutineSeed } from "@/domain/routine/engine/seed";
import { COMMERCIAL_GYM_DEFAULT_EQUIPMENT } from "@/domain/routine/engine/build-candidate-pool";
import {
  SafetyScreeningSchema,
  type SafetyScreening,
} from "@/domain/safety/schemas";
import { createBrowserRoutineRepository } from "@/persistence";
import { exerciseLabel } from "@/presentation/exercise-labels";

import styles from "./guided-routine-builder.module.css";

const STEPS = [
  "Objetivo",
  "Experiencia",
  "Disponibilidad",
  "Equipamiento",
  "Prioridades",
  "Restricciones",
  "Revisión",
] as const;

const GENERATION_STAGES = [
  "Interpretando tu pedido",
  "Buscando ejercicios compatibles",
  "Distribuyendo el volumen",
  "Validando la rutina",
] as const;

const EQUIPMENT = [
  "body_weight",
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "smith_machine",
  "bench",
  "barbell_rack",
  "pull_up_bar",
  "dip_bars",
  "preacher_bench",
  "hyperextension_bench",
  "kettlebell",
  "resistance_band",
  "band_anchor",
  "glute_ham_developer",
  "stability_ball",
  "step_platform",
] as const;

const MUSCLES = [
  "chest",
  "back",
  "lats",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "abs",
] as const;

const PATTERNS: readonly MovementPattern[] = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
];

const RISK_QUESTIONS = [
  ["painDuringMovement", "¿Sentís dolor durante algún movimiento?"],
  ["recentInjury", "¿Tuviste una lesión reciente?"],
  ["recentOperation", "¿Tuviste una operación reciente?"],
  ["medicalRestriction", "¿Tenés una restricción médica vigente?"],
  ["symptomsDuringExercise", "¿Tenés síntomas durante el ejercicio?"],
  [
    "professionalInstructionsAffectTraining",
    "¿Recibiste indicaciones profesionales que afecten el entrenamiento?",
  ],
] as const;

type RiskKey = (typeof RISK_QUESTIONS)[number][0];
type NullableSafety = {
  confirmedCurrentStatus: boolean;
} & Record<RiskKey, boolean | null>;

type BuilderState = {
  goal: RoutineGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  sessionMinutes: number;
  trainingLocation: TrainingLocation;
  availableEquipment: string[];
  focusMuscles: string[];
  excludedMovementPatterns: MovementPattern[];
  excludedText: string;
  preferredText: string;
  limitationsText: string;
  notes: string;
};

const DEFAULT_STATE: BuilderState = {
  goal: "hypertrophy",
  experience: "beginner",
  daysPerWeek: 3,
  sessionMinutes: 60,
  trainingLocation: "commercial_gym",
  availableEquipment: [...COMMERCIAL_GYM_DEFAULT_EQUIPMENT],
  focusMuscles: [],
  excludedMovementPatterns: [],
  excludedText: "",
  preferredText: "",
  limitationsText: "",
  notes: "",
};

const EMPTY_SAFETY: NullableSafety = {
  confirmedCurrentStatus: false,
  painDuringMovement: null,
  recentInjury: null,
  recentOperation: null,
  medicalRestriction: null,
  symptomsDuringExercise: null,
  professionalInstructionsAffectTraining: null,
};

function preset(example: string | undefined): BuilderState {
  if (example === "home") {
    return {
      ...DEFAULT_STATE,
      trainingLocation: "home",
      availableEquipment: ["body_weight", "dumbbell"],
    };
  }
  if (example === "strength") {
    return {
      ...DEFAULT_STATE,
      goal: "strength",
      experience: "intermediate",
      focusMuscles: ["quads"],
      preferredText: "sentadilla",
    };
  }
  if (example === "hypertrophy") {
    return { ...DEFAULT_STATE, goal: "hypertrophy", daysPerWeek: 4 };
  }
  return DEFAULT_STATE;
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[\n,;]+/u).map((item) => item.trim()).filter(Boolean))];
}

function toRequest(state: BuilderState): RoutineRequest {
  return RoutineRequestSchema.parse({
    goal: state.goal,
    experience: state.experience,
    daysPerWeek: state.daysPerWeek,
    sessionMinutes: state.sessionMinutes,
    trainingLocation: state.trainingLocation,
    availableEquipment: state.availableEquipment,
    focusMuscles: state.focusMuscles,
    excludedExercises: splitList(state.excludedText),
    excludedMovementPatterns: state.excludedMovementPatterns,
    preferredExercises: splitList(state.preferredText),
    limitations: splitList(state.limitationsText),
    notes: state.notes.trim() || null,
  });
}

function toSafety(state: NullableSafety): SafetyScreening {
  return SafetyScreeningSchema.parse(state);
}

function requestToState(request: Partial<RoutineRequest>, fallback: BuilderState): BuilderState {
  return {
    ...fallback,
    ...(request.goal ? { goal: request.goal } : {}),
    ...(request.experience ? { experience: request.experience } : {}),
    ...(request.daysPerWeek ? { daysPerWeek: request.daysPerWeek } : {}),
    ...(request.sessionMinutes ? { sessionMinutes: request.sessionMinutes } : {}),
    ...(request.trainingLocation ? { trainingLocation: request.trainingLocation } : {}),
    ...(request.availableEquipment
      ? { availableEquipment: request.availableEquipment }
      : {}),
    ...(request.focusMuscles ? { focusMuscles: request.focusMuscles } : {}),
    ...(request.excludedMovementPatterns
      ? { excludedMovementPatterns: request.excludedMovementPatterns }
      : {}),
    excludedText: request.excludedExercises?.join(", ") ?? fallback.excludedText,
    preferredText: request.preferredExercises?.join(", ") ?? fallback.preferredText,
    limitationsText: request.limitations?.join(", ") ?? fallback.limitationsText,
    notes: request.notes ?? fallback.notes,
  };
}

export function GuidedRoutineBuilder({
  catalog,
  datasetVersion,
  example,
}: {
  catalog: readonly CatalogExercise[];
  datasetVersion: string;
  example?: string;
}) {
  const router = useRouter();
  const initialState = useMemo(() => preset(example), [example]);
  const [state, setState] = useState<BuilderState>(initialState);
  const [safety, setSafety] = useState<NullableSafety>(EMPTY_SAFETY);
  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(Boolean(example));
  const [generationStage, setGenerationStage] = useState<number | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    if (example) return;
    void createBrowserRoutineRepository()
      .loadSetupDraft()
      .then((draft) => {
        if (draft) setState((current) => requestToState(draft, current));
        setHydrated(true);
      });
  }, [example]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const request = toRequest(state);
      void createBrowserRoutineRepository().saveSetupDraft(request);
    } catch {
      // Incomplete intermediate form state is intentionally kept in React until valid.
    }
  }, [hydrated, state]);

  const update = <Key extends keyof BuilderState>(key: Key, value: BuilderState[Key]) => {
    setState((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const toggleList = <Value extends string>(
    key: "availableEquipment" | "focusMuscles" | "excludedMovementPatterns",
    value: Value,
  ) => {
    setState((current) => {
      const values = current[key] as string[];
      return {
        ...current,
        [key]: values.includes(value)
          ? values.filter((item) => item !== value)
          : [...values, value],
      };
    });
  };

  const chooseLocation = (location: TrainingLocation) => {
    const equipment =
      location === "commercial_gym"
        ? [...DEFAULT_STATE.availableEquipment]
        : location === "home"
          ? ["body_weight", "dumbbell"]
          : ["body_weight"];
    setState((current) => ({
      ...current,
      trainingLocation: location,
      availableEquipment: equipment,
    }));
  };

  const canContinue =
    step !== 3 || state.availableEquipment.length > 0;
  const safetyComplete =
    safety.confirmedCurrentStatus &&
    RISK_QUESTIONS.every(([key]) => safety[key] !== null);

  const generate = async () => {
    setError(null);
    let request: RoutineRequest;
    let screening: SafetyScreening;
    try {
      request = toRequest(state);
      screening = toSafety(safety);
    } catch {
      setError({
        code: "INVALID_INPUT",
        message: "Revisá los datos del formulario antes de generar la rutina.",
      });
      return;
    }

    setGenerationStage(0);
    for (let index = 0; index < GENERATION_STAGES.length; index += 1) {
      setGenerationStage(index);
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }

    const seed = createRoutineSeed(new Date().toISOString(), crypto.randomUUID());
    const result = generateRoutineUseCase({
      request,
      safetyScreening: screening,
      catalog,
      datasetVersion,
      seed,
    });

    if (!result.ok) {
      setGenerationStage(null);
      setError({ code: result.code, message: result.message });
      return;
    }

    await createBrowserRoutineRepository().saveCurrentRoutine(
      request,
      result.plan,
      screening,
    );
    router.push("/rutina");
  };

  if (generationStage !== null) {
    return (
      <section className={[styles.generation, "shell"].join(" ")} aria-live="polite">
        <LoaderCircle className={styles.spinner} aria-hidden="true" />
        <p className="eyebrow">Motor determinista · sin IA</p>
        <h1>Estamos armando tu rutina.</h1>
        <ol>
          {GENERATION_STAGES.map((label, index) => (
            <li
              key={label}
              className={
                index < generationStage
                  ? styles.done
                  : index === generationStage
                    ? styles.active
                    : ""
              }
            >
              {index < generationStage ? (
                <BadgeCheck aria-hidden="true" />
              ) : (
                <span>{String(index + 1).padStart(2, "0")}</span>
              )}
              {label}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">Formulario guiado · funciona sin IA</p>
          <h1>Armemos tu perfil de rutina.</h1>
          <p>
            Siete pasos breves producen el mismo contrato estructurado que usaría el chat.
          </p>
        </div>
        <Link className="button button-quiet" href="/crear/chat">
          Preferir chat opcional
        </Link>
      </header>

      <div className={styles.progress}>
        <div
          role="progressbar"
          aria-label="Progreso del formulario"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <span style={{ width: String(((step + 1) / STEPS.length) * 100) + "%" }} />
        </div>
        <p>
          <span>
            Paso {step + 1} de {STEPS.length}
          </span>
          <strong>{STEPS[step]}</strong>
        </p>
      </div>

      <section className={styles.formCard} aria-labelledby="step-title">
        {step === 0 && (
          <FormStep
            eyebrow="Objetivo"
            title="¿Qué querés priorizar?"
            description="El motor ajusta volumen, repeticiones y descansos sin prometer resultados automáticos."
          >
            <OptionGrid>
              <Option
                selected={state.goal === "hypertrophy"}
                title="Hipertrofia"
                description="Aumentar masa muscular con volumen progresivo."
                onClick={() => update("goal", "hypertrophy")}
              />
              <Option
                selected={state.goal === "strength"}
                title="Fuerza"
                description="Priorizar rendimiento en patrones compuestos."
                onClick={() => update("goal", "strength")}
              />
              <Option
                selected={state.goal === "general_fitness"}
                title="Acondicionamiento general"
                description="Una base equilibrada de fuerza y capacidad."
                onClick={() => update("goal", "general_fitness")}
              />
              <Option
                selected={state.goal === "muscular_endurance"}
                title="Resistencia muscular"
                description="Más repeticiones y tolerancia al trabajo."
                onClick={() => update("goal", "muscular_endurance")}
              />
            </OptionGrid>
          </FormStep>
        )}

        {step === 1 && (
          <FormStep
            eyebrow="Experiencia"
            title="¿Cuál es tu nivel actual?"
            description="Elegí según tu experiencia técnica sostenida, no según los kilos que levantás."
          >
            <OptionGrid>
              <Option
                selected={state.experience === "beginner"}
                title="Principiante"
                description="Hasta un año de práctica consistente."
                onClick={() => update("experience", "beginner")}
              />
              <Option
                selected={state.experience === "intermediate"}
                title="Intermedio"
                description="Técnica estable y más de un año consistente."
                onClick={() => update("experience", "intermediate")}
              />
              <Option
                selected={state.experience === "advanced"}
                title="Avanzado"
                description="Varios años de entrenamiento estructurado."
                onClick={() => update("experience", "advanced")}
              />
            </OptionGrid>
          </FormStep>
        )}

        {step === 2 && (
          <FormStep
            eyebrow="Disponibilidad"
            title="¿Cuánto tiempo tenés de verdad?"
            description="La duración es un techo por sesión. FORMA no agrega trabajo para llenar tiempo."
          >
            <div className={styles.fieldGrid}>
              <label>
                <span>Días por semana</span>
                <select
                  value={state.daysPerWeek}
                  onChange={(event) => update("daysPerWeek", Number(event.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((days) => (
                    <option value={days} key={days}>
                      {days} {days === 1 ? "día" : "días"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Minutos por sesión</span>
                <select
                  value={state.sessionMinutes}
                  onChange={(event) =>
                    update("sessionMinutes", Number(event.target.value))
                  }
                >
                  {[30, 45, 60, 75, 90, 120].map((minutes) => (
                    <option value={minutes} key={minutes}>
                      {minutes} minutos
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className={styles.location}>
              <legend>Lugar de entrenamiento</legend>
              <OptionGrid>
                <Option
                  selected={state.trainingLocation === "commercial_gym"}
                  title="Gimnasio comercial"
                  description="Barra, poleas, mancuernas y máquinas."
                  onClick={() => chooseLocation("commercial_gym")}
                />
                <Option
                  selected={state.trainingLocation === "home"}
                  title="Casa"
                  description="Configuración compacta y peso corporal."
                  onClick={() => chooseLocation("home")}
                />
                <Option
                  selected={state.trainingLocation === "custom"}
                  title="Otro espacio"
                  description="Vas a elegir el equipamiento disponible."
                  onClick={() => chooseLocation("custom")}
                />
              </OptionGrid>
            </fieldset>
          </FormStep>
        )}

        {step === 3 && (
          <FormStep
            eyebrow="Equipamiento"
            title="Marcá únicamente lo que podés usar."
            description="La selección de ejercicios se filtra antes de puntuar candidatos."
          >
            <CheckboxGrid>
              {EQUIPMENT.map((equipment) => (
                <CheckOption
                  key={equipment}
                  checked={state.availableEquipment.includes(equipment)}
                  label={exerciseLabel(equipment)}
                  onChange={() => toggleList("availableEquipment", equipment)}
                />
              ))}
            </CheckboxGrid>
            {state.availableEquipment.length === 0 && (
              <p className={styles.inlineError}>Elegí al menos una opción.</p>
            )}
          </FormStep>
        )}

        {step === 4 && (
          <FormStep
            eyebrow="Prioridades"
            title="¿Hay músculos o ejercicios que quieras priorizar?"
            description="Es opcional. Las prioridades modifican el puntaje, pero no anulan las reglas de equilibrio."
          >
            <CheckboxGrid>
              {MUSCLES.map((muscle) => (
                <CheckOption
                  key={muscle}
                  checked={state.focusMuscles.includes(muscle)}
                  label={exerciseLabel(muscle)}
                  onChange={() => toggleList("focusMuscles", muscle)}
                />
              ))}
            </CheckboxGrid>
            <label className={styles.textField}>
              <span>Ejercicios preferidos, separados por coma</span>
              <input
                value={state.preferredText}
                onChange={(event) => update("preferredText", event.target.value)}
                placeholder="Ejemplo: sentadilla, dominadas"
              />
            </label>
          </FormStep>
        )}

        {step === 5 && (
          <FormStep
            eyebrow="Restricciones y seguridad"
            title="Contanos qué debemos evitar."
            description="FORMA no evalúa lesiones ni arma rehabilitación. Las respuestas sensibles bloquean la generación y conservan tus datos."
          >
            <div className={styles.restrictionFields}>
              <label className={styles.textField}>
                <span>Ejercicios a evitar</span>
                <textarea
                  value={state.excludedText}
                  onChange={(event) => update("excludedText", event.target.value)}
                  placeholder="Separalos por coma o por línea"
                />
              </label>
              <label className={styles.textField}>
                <span>Limitaciones actuales o instrucciones claras</span>
                <textarea
                  value={state.limitationsText}
                  onChange={(event) => update("limitationsText", event.target.value)}
                  placeholder="No incluyas diagnósticos; indicá movimientos concretos a evitar"
                />
              </label>
            </div>
            <fieldset className={styles.patterns}>
              <legend>Patrones de movimiento a evitar</legend>
              <CheckboxGrid>
                {PATTERNS.map((pattern) => (
                  <CheckOption
                    key={pattern}
                    checked={state.excludedMovementPatterns.includes(pattern)}
                    label={exerciseLabel(pattern)}
                    onChange={() => toggleList("excludedMovementPatterns", pattern)}
                  />
                ))}
              </CheckboxGrid>
            </fieldset>

            <div className={styles.safetyQuestions}>
              <div className={styles.safetyIntro}>
                <ShieldCheck aria-hidden="true" />
                <div>
                  <h3>Chequeo previo obligatorio</h3>
                  <p>Respondé según tu situación actual. No hacemos inferencias médicas.</p>
                </div>
              </div>
              {RISK_QUESTIONS.map(([key, question]) => (
                <RiskQuestion
                  key={key}
                  question={question}
                  value={safety[key]}
                  onChange={(value) =>
                    setSafety((current) => ({ ...current, [key]: value }))
                  }
                />
              ))}
              <label className={styles.confirmation}>
                <input
                  type="checkbox"
                  checked={safety.confirmedCurrentStatus}
                  onChange={(event) =>
                    setSafety((current) => ({
                      ...current,
                      confirmedCurrentStatus: event.target.checked,
                    }))
                  }
                />
                Confirmo que estas respuestas describen mi situación actual.
              </label>
            </div>
          </FormStep>
        )}

        {step === 6 && (
          <FormStep
            eyebrow="Revisión"
            title="Este es el contrato que va a usar el motor."
            description="Podés volver a cualquier paso. La IA no es necesaria para completar ni validar esta información."
          >
            <dl className={styles.review}>
              <Review label="Objetivo" value={goalLabel(state.goal)} />
              <Review label="Experiencia" value={exerciseLabel(state.experience)} />
              <Review
                label="Disponibilidad"
                value={
                  state.daysPerWeek +
                  " días · " +
                  state.sessionMinutes +
                  " minutos por sesión"
                }
              />
              <Review
                label="Equipamiento"
                value={state.availableEquipment.map(exerciseLabel).join(", ")}
              />
              <Review
                label="Prioridades"
                value={
                  state.focusMuscles.length
                    ? state.focusMuscles.map(exerciseLabel).join(", ")
                    : "Sin prioridad específica"
                }
              />
              <Review
                label="Exclusiones"
                value={
                  [
                    ...splitList(state.excludedText),
                    ...state.excludedMovementPatterns.map(exerciseLabel),
                  ].join(", ") || "Sin exclusiones declaradas"
                }
              />
              <Review
                label="Seguridad"
                value={
                  safetyComplete
                    ? RISK_QUESTIONS.some(([key]) => safety[key] === true)
                      ? "Requiere orientación profesional"
                      : "Respuestas completas, sin señales declaradas"
                    : "Falta completar el chequeo"
                }
              />
            </dl>
            <label className={styles.textField}>
              <span>Notas opcionales</span>
              <textarea
                value={state.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Algo más que ayude a entender tu pedido"
              />
            </label>

            {error && (
              <div
                className={
                  error.code === "SAFETY_BLOCKED"
                    ? styles.safetyError
                    : styles.generationError
                }
                role="alert"
              >
                <CircleAlert aria-hidden="true" />
                <div>
                  <strong>
                    {error.code === "SAFETY_BLOCKED"
                      ? "Este pedido necesita más cuidado."
                      : "No pudimos generar una rutina válida."}
                  </strong>
                  <p>{error.message}</p>
                  {error.code === "SAFETY_BLOCKED" && (
                    <Link href="/ejercicios">Seguir explorando ejercicios</Link>
                  )}
                </div>
              </div>
            )}
          </FormStep>
        )}

        <div className={styles.navigation}>
          {step > 0 ? (
            <button type="button" className="button button-quiet" onClick={() => setStep(step - 1)}>
              <ArrowLeft aria-hidden="true" size={17} /> Atrás
            </button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="button button-primary"
              disabled={!canContinue}
              onClick={() => setStep(step + 1)}
            >
              Continuar <ArrowRight aria-hidden="true" size={17} />
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary"
              disabled={!safetyComplete}
              onClick={() => void generate()}
            >
              <ClipboardCheck aria-hidden="true" size={18} /> Generar rutina
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function FormStep({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.step}>
      <header>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id="step-title">{title}</h2>
        <p>{description}</p>
      </header>
      {children}
    </div>
  );
}

function OptionGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.optionGrid}>{children}</div>;
}

function Option({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.option}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span>{selected ? <BadgeCheck aria-hidden="true" /> : null}</span>
      <strong>{title}</strong>
      <small>{description}</small>
    </button>
  );
}

function CheckboxGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.checkboxGrid}>{children}</div>;
}

function CheckOption({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className={styles.checkOption}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function RiskQuestion({
  question,
  value,
  onChange,
}: {
  question: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className={styles.riskQuestion}>
      <legend>{question}</legend>
      <label>
        <input
          type="radio"
          checked={value === false}
          onChange={() => onChange(false)}
        />
        No
      </label>
      <label>
        <input type="radio" checked={value === true} onChange={() => onChange(true)} />
        Sí
      </label>
    </fieldset>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function goalLabel(goal: RoutineGoal): string {
  return {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Acondicionamiento general",
    muscular_endurance: "Resistencia muscular",
  }[goal];
}
