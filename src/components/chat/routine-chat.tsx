"use client";

import {
  ArrowRight,
  Bot,
  Check,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AiFallbackState } from "@/ai/errors";
import {
  ParseRoutineResultSchema,
  toCompleteRoutineRequest,
  type ParseRoutineResult,
  type RoutineRequestDraft,
} from "@/ai/schemas/routine-request";
import { generateRoutineUseCase } from "@/application/routines";
import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "@/domain/profile/routine-request";
import { createRoutineSeed } from "@/domain/routine/engine/seed";
import {
  SafetyScreeningSchema,
  type SafetyScreening,
} from "@/domain/safety/schemas";
import {
  createBrowserRoutineRepository,
  type ConversationMessage,
} from "@/persistence";
import { exerciseLabel } from "@/presentation/exercise-labels";

import styles from "./routine-chat.module.css";

const EMPTY_DRAFT: RoutineRequestDraft = {
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  trainingLocation: null,
  availableEquipment: [],
  focusMuscles: [],
  excludedExercises: [],
  excludedMovementPatterns: [],
  preferredExercises: [],
  limitations: [],
  notes: null,
};

const REQUIRED_LABELS = {
  goal: "objetivo",
  experience: "experiencia",
  daysPerWeek: "días por semana",
  sessionMinutes: "duración por sesión",
  trainingLocationOrEquipment: "lugar o equipamiento",
  limitationsConfirmation: "confirmación de limitaciones",
} as const;

const SUGGESTIONS = [
  "Quiero hipertrofia, soy intermedio, tengo 4 días y 60 minutos. Entreno en gimnasio con barra, mancuernas, poleas y máquinas. No tengo dolor ni restricciones.",
  "Soy principiante y quiero entrenar fuerza 3 días, 45 minutos en casa con mancuernas y peso corporal. Sin limitaciones.",
  "Quiero acondicionamiento general 2 veces por semana, 45 minutos, con máquinas y mancuernas. No tengo lesiones ni dolor.",
] as const;

const RISK_QUESTIONS = [
  ["painDuringMovement", "Dolor durante algún movimiento"],
  ["recentInjury", "Lesión reciente"],
  ["recentOperation", "Operación reciente"],
  ["medicalRestriction", "Restricción médica vigente"],
  ["symptomsDuringExercise", "Síntomas durante el ejercicio"],
  [
    "professionalInstructionsAffectTraining",
    "Indicaciones profesionales que afectan el entrenamiento",
  ],
] as const;

type RiskKey = (typeof RISK_QUESTIONS)[number][0];
type LimitationsConfirmation = ParseRoutineResult["limitationsConfirmation"];
type SafetyAnswers = {
  confirmedCurrentStatus: boolean;
} & Record<RiskKey, boolean | null>;

const EMPTY_SAFETY: SafetyAnswers = {
  confirmedCurrentStatus: false,
  painDuringMovement: null,
  recentInjury: null,
  recentOperation: null,
  medicalRestriction: null,
  symptomsDuringExercise: null,
  professionalInstructionsAffectTraining: null,
};

type InterpretSuccess = {
  ok: true;
  provider: { id: string; model: string | null };
  result: unknown;
};

type InterpretFailure = {
  ok: false;
  provider?: { id: string; model: string | null };
  error: AiFallbackState | { code: string; message: string };
};

function draftFromProfile(profile: Partial<RoutineRequest>): RoutineRequestDraft {
  return {
    ...EMPTY_DRAFT,
    ...profile,
    goal: profile.goal ?? null,
    experience: profile.experience ?? null,
    daysPerWeek: profile.daysPerWeek ?? null,
    sessionMinutes: profile.sessionMinutes ?? null,
    trainingLocation: profile.trainingLocation ?? null,
    notes: profile.notes ?? null,
  };
}

function profileFromDraft(draft: RoutineRequestDraft): Partial<RoutineRequest> {
  return {
    ...(draft.goal ? { goal: draft.goal } : {}),
    ...(draft.experience ? { experience: draft.experience } : {}),
    ...(draft.daysPerWeek ? { daysPerWeek: draft.daysPerWeek } : {}),
    ...(draft.sessionMinutes ? { sessionMinutes: draft.sessionMinutes } : {}),
    ...(draft.trainingLocation ? { trainingLocation: draft.trainingLocation } : {}),
    availableEquipment: draft.availableEquipment,
    focusMuscles: draft.focusMuscles,
    excludedExercises: draft.excludedExercises,
    excludedMovementPatterns: draft.excludedMovementPatterns,
    preferredExercises: draft.preferredExercises,
    limitations: draft.limitations,
    notes: draft.notes,
  };
}

function assistantMessage(result: ParseRoutineResult): string {
  if (result.status === "unsupported") {
    return "Este pedido necesita más cuidado. FORMA no puede evaluar lesiones, indicar rehabilitación ni reemplazar una orientación profesional.";
  }
  if (result.status === "complete") {
    return "Ya tengo un perfil estructurado completo. Revisá el resumen y respondé el chequeo de seguridad antes de generar.";
  }
  const missing = result.missingFields.map((field) => REQUIRED_LABELS[field]);
  return "Para completar el perfil todavía necesito: " + missing.join(", ") + ".";
}

export function RoutineChat({
  catalog,
  datasetVersion,
}: {
  catalog: readonly CatalogExercise[];
  datasetVersion: string;
}) {
  const router = useRouter();
  const threadRef = useRef<HTMLDivElement>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState<RoutineRequestDraft>(EMPTY_DRAFT);
  const [confirmation, setConfirmation] =
    useState<LimitationsConfirmation>("not_confirmed");
  const [latest, setLatest] = useState<ParseRoutineResult | null>(null);
  const [provider, setProvider] = useState<{ id: string; model: string | null } | null>(
    null,
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [fallback, setFallback] = useState<AiFallbackState | null>(null);
  const [safety, setSafety] = useState<SafetyAnswers>(EMPTY_SAFETY);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    void createBrowserRoutineRepository()
      .loadConversation()
      .then((conversation) => {
        setMessages(conversation.messages);
        setDraft(draftFromProfile(conversation.structuredProfile));
        setConfirmation(conversation.limitationsConfirmation);
      });
    return () => requestAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages, loading]);

  const persistConversation = (
    nextMessages: ConversationMessage[],
    nextDraft: RoutineRequestDraft,
    nextConfirmation: LimitationsConfirmation,
  ) =>
    createBrowserRoutineRepository().saveConversation({
      messages: nextMessages,
      structuredProfile: profileFromDraft(nextDraft),
      limitationsConfirmation: nextConfirmation,
    });

  const send = async (messageText = input) => {
    const text = messageText.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setFallback(null);
    setGenerationError(null);
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const withUser = [...messages, userMessage];
    setMessages(withUser);
    await persistConversation(withUser, draft, confirmation);

    try {
      const response = await fetch("/api/ai/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          currentDraft: draft,
          currentLimitationsConfirmation: confirmation,
          locale: "es-AR",
        }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as InterpretSuccess | InterpretFailure;
      if (!payload.ok) {
        const state: AiFallbackState =
          "title" in payload.error
            ? payload.error
            : {
                code: "invalid_input",
                title: "No pudimos interpretar el mensaje",
                message: payload.error.message,
                action: "guided_form",
                canRetry: false,
              };
        setProvider(payload.provider ?? null);
        setFallback(state);
        return;
      }

      const result = ParseRoutineResultSchema.parse(payload.result);
      setProvider(payload.provider);
      setDraft(result.request);
      setConfirmation(result.limitationsConfirmation);
      setLatest(result);

      const reply: ConversationMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantMessage(result),
        createdAt: new Date().toISOString(),
      };
      const nextMessages = [...withUser, reply];
      setMessages(nextMessages);
      await persistConversation(
        nextMessages,
        result.request,
        result.limitationsConfirmation,
      );

      const complete = toCompleteRoutineRequest(result);
      if (complete) {
        await createBrowserRoutineRepository().saveSetupDraft(complete);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFallback({
        code: "provider_error",
        title: "El asistente no está disponible",
        message:
          "Tu información sigue guardada. Podés reintentar o continuar con el formulario guiado.",
        action: "guided_form",
        canRetry: true,
      });
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null;
        setLoading(false);
      }
    }
  };

  const completeRequest = useMemo(() => {
    if (latest) return toCompleteRoutineRequest(latest);
    if (confirmation === "not_confirmed") return null;
    const candidate = {
      ...draft,
      goal: draft.goal ?? undefined,
      experience: draft.experience ?? undefined,
      daysPerWeek: draft.daysPerWeek ?? undefined,
      sessionMinutes: draft.sessionMinutes ?? undefined,
      trainingLocation: draft.trainingLocation ?? undefined,
    };
    const parsed = RoutineRequestSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  }, [confirmation, draft, latest]);
  const safetyComplete =
    safety.confirmedCurrentStatus &&
    RISK_QUESTIONS.every(([key]) => safety[key] !== null);

  const generate = async () => {
    if (!completeRequest || !safetyComplete) return;
    let screening: SafetyScreening;
    try {
      screening = SafetyScreeningSchema.parse(safety);
    } catch {
      setGenerationError("Completá el chequeo de seguridad.");
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const result = generateRoutineUseCase({
      request: completeRequest,
      safetyScreening: screening,
      catalog,
      datasetVersion,
      seed: createRoutineSeed(new Date().toISOString(), crypto.randomUUID()),
    });
    if (!result.ok) {
      setGenerating(false);
      setGenerationError(result.message);
      return;
    }
    await createBrowserRoutineRepository().saveCurrentRoutine(
      completeRequest,
      result.plan,
      screening,
    );
    router.push("/rutina");
  };

  const profileItems = [
    ["Objetivo", draft.goal ? goalLabel(draft.goal) : null],
    ["Nivel", draft.experience ? exerciseLabel(draft.experience) : null],
    ["Días", draft.daysPerWeek ? String(draft.daysPerWeek) + " por semana" : null],
    [
      "Duración",
      draft.sessionMinutes ? String(draft.sessionMinutes) + " minutos" : null,
    ],
    [
      "Lugar",
      draft.trainingLocation ? locationLabel(draft.trainingLocation) : null,
    ],
    [
      "Equipamiento",
      draft.availableEquipment.length
        ? draft.availableEquipment.map(exerciseLabel).join(", ")
        : null,
    ],
  ] as const;

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">Interpretación opcional · motor determinista</p>
          <h1>Contame cómo querés entrenar.</h1>
          <p>
            El asistente sólo estructura tu pedido. No elige ejercicios ni puede saltear la
            validación.
          </p>
        </div>
        <Link className="button button-quiet" href="/crear">
          <ClipboardList aria-hidden="true" size={17} /> Completar con formulario
        </Link>
      </header>

      <div className={styles.workspace}>
        <section className={styles.chat} aria-labelledby="chat-title">
          <div className={styles.chatTop}>
            <div>
              <span className="eyebrow" id="chat-title">
                Conversación
              </span>
              <strong>
                {provider
                  ? provider.id + (provider.model ? " · " + provider.model : "")
                  : "Proveedor al enviar"}
              </strong>
            </div>
            <span className={styles.providerDot} aria-hidden="true" />
          </div>

          <div className={styles.thread} ref={threadRef} aria-live="polite">
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <Bot aria-hidden="true" />
                <p>
                  Incluí objetivo, nivel, días, minutos, lugar o equipamiento y si tenés
                  limitaciones actuales.
                </p>
              </div>
            )}
            {messages.map((message) => (
              <article
                key={message.id}
                className={message.role === "user" ? styles.userMessage : styles.aiMessage}
              >
                <span>
                  {message.role === "user" ? (
                    <UserRound aria-hidden="true" />
                  ) : (
                    <Bot aria-hidden="true" />
                  )}
                </span>
                <p>{message.content}</p>
              </article>
            ))}
            {loading && (
              <div className={styles.typing}>
                <LoaderCircle aria-hidden="true" /> Interpretando y validando el contrato…
              </div>
            )}
          </div>

          {fallback && (
            <div className={styles.fallback} role="alert">
              <CircleAlert aria-hidden="true" />
              <div>
                <strong>{fallback.title}</strong>
                <p>{fallback.message}</p>
                <div>
                  {fallback.canRetry && (
                    <button
                      type="button"
                      onClick={() =>
                        void send(
                          messages.findLast((message) => message.role === "user")
                            ?.content ?? "",
                        )
                      }
                    >
                      Reintentar
                    </button>
                  )}
                  <Link href="/crear">Continuar con formulario</Link>
                </div>
              </div>
            </div>
          )}

          <div className={styles.suggestions}>
            {SUGGESTIONS.map((suggestion, index) => (
              <button type="button" key={suggestion} onClick={() => setInput(suggestion)}>
                Ejemplo {index + 1}
              </button>
            ))}
          </div>
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label>
              <span className="sr-only">Mensaje para describir la rutina</span>
              <textarea
                value={input}
                maxLength={2_000}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ejemplo: quiero hipertrofia, cuatro días…"
              />
            </label>
            <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar mensaje">
              <Send aria-hidden="true" />
            </button>
          </form>
        </section>

        <aside className={styles.profile} aria-labelledby="profile-title">
          <div className={styles.profileTop}>
            <div>
              <p className="eyebrow">Resumen estructurado</p>
              <h2 id="profile-title">Perfil de rutina</h2>
            </div>
            <span>{profileItems.filter(([, value]) => value).length} de 6 datos</span>
          </div>
          <dl>
            {profileItems.map(([label, value]) => (
              <div key={label} className={value ? styles.completeField : styles.missingField}>
                <dt>{label}</dt>
                <dd>{value ?? "Esperando…"} </dd>
              </div>
            ))}
          </dl>
          {latest?.missingFields.length ? (
            <div className={styles.missing}>
              <strong>Información pendiente</strong>
              <ul>
                {latest.missingFields.map((field) => (
                  <li key={field}>{REQUIRED_LABELS[field]}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {completeRequest && (
            <div className={styles.chatSafety}>
              <div>
                <ShieldCheck aria-hidden="true" />
                <h3>Chequeo de seguridad</h3>
              </div>
              <p>Confirmá explícitamente cada punto antes de generar.</p>
              {RISK_QUESTIONS.map(([key, question]) => (
                <fieldset key={key}>
                  <legend>{question}</legend>
                  <label>
                    <input
                      type="radio"
                      checked={safety[key] === false}
                      onChange={() =>
                        setSafety((current) => ({ ...current, [key]: false }))
                      }
                    />
                    No
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={safety[key] === true}
                      onChange={() =>
                        setSafety((current) => ({ ...current, [key]: true }))
                      }
                    />
                    Sí
                  </label>
                </fieldset>
              ))}
              <label className={styles.confirm}>
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
                Estas respuestas describen mi situación actual.
              </label>
              {generationError && (
                <p className={styles.generateError} role="alert">
                  {generationError}
                </p>
              )}
              <button
                type="button"
                className="button button-primary"
                disabled={!safetyComplete || generating}
                onClick={() => void generate()}
              >
                {generating ? (
                  <LoaderCircle aria-hidden="true" />
                ) : (
                  <Check aria-hidden="true" />
                )}
                {generating ? "Validando rutina…" : "Generar rutina validada"}
              </button>
            </div>
          )}

          {!completeRequest && (
            <Link className={styles.formFallback} href="/crear">
              Podés terminar el mismo perfil en el formulario
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}

function goalLabel(goal: NonNullable<RoutineRequestDraft["goal"]>): string {
  return {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Acondicionamiento general",
    muscular_endurance: "Resistencia muscular",
  }[goal];
}

function locationLabel(
  location: NonNullable<RoutineRequestDraft["trainingLocation"]>,
): string {
  return {
    commercial_gym: "Gimnasio comercial",
    home: "Casa",
    custom: "Otro espacio",
  }[location];
}
