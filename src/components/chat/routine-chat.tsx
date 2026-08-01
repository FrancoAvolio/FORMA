"use client";

import {
  ArrowRight,
  Bot,
  Bug,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Square,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { AiProviderName } from "@/ai/ai-provider";
import {
  AI_ERROR_CODES,
  type AiErrorCode,
  type AiFallbackState,
} from "@/ai/errors";
import {
  AssistantResponseSchema,
  ComposeAssistantResponseInputDataSchema,
  GroundedExerciseResponseContextSchema,
  ParsedRoutineTurnSchema,
  RoutineModificationResultSchema,
  type ValidatedAssistantResponseContext,
} from "@/ai/schemas";
import {
  applyParsedRoutineTurn,
  buildRoutinePlanContext,
  buildValidatedPlanSummary,
  composeAssistantFallback,
  deriveAssistantSafetyResult,
  OFF_TOPIC_REPLY,
  reconcileParsedTurnSafety,
  resolveConversationQuestion,
  resolvePendingConversationAnswer,
  selectFocusedQuestionFields,
  toCompleteRoutineRequest,
  type AssistantSafetyResult,
  type ConversationExerciseTarget,
  type DerivedRoutineTurnResult,
  type ValidatedPlanSummary,
} from "@/application/conversation";
import {
  applyConversationRoutineModification,
  generateRoutineUseCase,
} from "@/application/routines";
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail";
import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import { createPendingSafetyQuestion } from "@/domain/conversation/pending-question";
import {
  getUserMessageMetrics,
  USER_MESSAGE_LIMITS,
} from "@/domain/conversation/user-message";
import type { RoutineRequest } from "@/domain/profile/routine-request";
import { createRoutineSeed } from "@/domain/routine/engine/seed";
import { evaluateRoutineSafety } from "@/domain/safety/evaluate-safety";
import {
  CONVERSATIONAL_SAFETY_FIELD_VALUES,
  deriveMissingSafetyFields,
  toCompleteSafetyScreening,
  type ConversationalSafetyField,
  type ConversationalSafetyScreeningDraft,
} from "@/domain/safety/conversational-screening";
import type { ExerciseMedia } from "@/media";
import {
  createBrowserRoutineRepository,
  createIdleAiProviderState,
  type AiProviderState,
  type ConversationMessage,
  type RoutineConversationState,
  type RoutineConversationStateUpdate,
  type RoutineRepository,
} from "@/persistence";
import {
  exerciseLabel,
  exerciseListLabel,
} from "@/presentation/exercise-labels";

import { ConversationRoutinePreview } from "./conversation-routine-preview";
import styles from "./routine-chat.module.css";

const INITIAL_MESSAGE =
  "Hola, soy FORMA. Contame con tus palabras qué querés lograr, cuántos días podés entrenar y con qué equipamiento contás. Voy a ordenar el perfil y armar la rutina acá mismo.";

const DESKTOP_PROFILE_QUERY = "(min-width: 58rem)";
const MESSAGE_COUNT_FORMATTER = new Intl.NumberFormat("es-AR");

function subscribeDesktopProfile(callback: () => void): () => void {
  const query = window.matchMedia(DESKTOP_PROFILE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isDesktopProfile(): boolean {
  return window.matchMedia(DESKTOP_PROFILE_QUERY).matches;
}

function serverDesktopProfile(): boolean {
  return false;
}

function matchesSavedSnapshot(
  current: {
    request: unknown;
    plan: unknown;
    safetyScreening: unknown;
  },
  saved: {
    request: unknown;
    plan: unknown;
    safetyScreening: unknown;
  },
): boolean {
  return (
    JSON.stringify(current.request) === JSON.stringify(saved.request) &&
    JSON.stringify(current.plan) === JSON.stringify(saved.plan) &&
    JSON.stringify(current.safetyScreening) ===
      JSON.stringify(saved.safetyScreening)
  );
}

const SUGGESTIONS = [
  "Quiero ganar músculo",
  "Soy intermedio y entreno cuatro días",
  "Tengo una hora y gimnasio completo",
] as const;

const REQUIRED_LABELS = {
  goal: "Objetivo",
  experience: "Experiencia",
  daysPerWeek: "Días por semana",
  sessionMinutes: "Duración por sesión",
  trainingLocationOrEquipment: "Lugar o equipamiento",
  limitationsConfirmation: "Seguridad y limitaciones",
} as const;

const GOAL_LABELS: Record<NonNullable<RoutineRequest["goal"]>, string> = {
  hypertrophy: "Ganar masa muscular",
  strength: "Ganar fuerza",
  general_fitness: "Estado físico general",
  muscular_endurance: "Resistencia muscular",
};

const EXPERIENCE_LABELS: Record<
  NonNullable<RoutineRequest["experience"]>,
  string
> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const LOCATION_LABELS: Record<
  NonNullable<RoutineRequest["trainingLocation"]>,
  string
> = {
  commercial_gym: "Gimnasio completo",
  home: "Casa",
  custom: "Equipamiento personalizado",
};

type ProviderDiagnostics = {
  provider: AiProviderName;
  model: string | null;
};

type SuccessfulEnvelope = { ok: true } & Record<string, unknown>;

type GroundedExerciseCard = {
  questionKind: string;
  exercise: {
    id: string;
    displayName: string;
    displayNameEs: string | null;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    requiredEquipment: string[];
    instructionsEs: string;
    instructionStepsEs: string[];
    sourceAttribution: string;
  };
  routine: {
    dayName: string;
    prescription: {
      sets: number;
      repPrescription: string;
      restSeconds: number;
      rir: number | null;
    };
    selectionReasons: string[];
  } | null;
  alternatives: Array<{
    id: string;
    displayName: string;
    displayNameEs: string | null;
    compatibilityReasons: string[];
  }>;
  grounding: {
    source: "validated_local_catalog";
    datasetCommit: string;
  };
};

class ChatRequestError extends Error {
  constructor(readonly fallback: AiFallbackState) {
    super(fallback.message);
    this.name = "ChatRequestError";
  }
}

function now(): string {
  return new Date().toISOString();
}

function createMessage(
  role: ConversationMessage["role"],
  content: string,
): ConversationMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: now(),
  };
}

function safetyAnsweredCount(
  draft: ConversationalSafetyScreeningDraft,
): number {
  return 6 - deriveMissingSafetyFields(draft).length;
}

function isAiErrorCode(value: unknown): value is AiErrorCode {
  return (
    typeof value === "string" &&
    (AI_ERROR_CODES as readonly string[]).includes(value)
  );
}

function fallbackFromPayload(payload: unknown, status = 503): AiFallbackState {
  const envelope =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const error =
    envelope?.error && typeof envelope.error === "object"
      ? (envelope.error as Record<string, unknown>)
      : null;
  const code = isAiErrorCode(error?.code)
    ? error.code
    : status === 429
      ? "rate_limited"
      : "provider_error";
  const message =
    typeof error?.message === "string"
      ? error.message
      : "El asistente no pudo completar este turno. Tu progreso sigue guardado.";
  return {
    code,
    title:
      typeof error?.title === "string"
        ? error.title
        : code === "rate_limited"
          ? "Hay demasiadas solicitudes"
          : "El asistente no está disponible",
    message,
    action: error?.action === "none" ? "none" : "guided_form",
    canRetry:
      typeof error?.canRetry === "boolean"
        ? error.canRetry
        : [
            "unavailable",
            "timeout",
            "invalid_output",
            "rate_limited",
            "provider_error",
          ].includes(code),
    ...(typeof error?.retryAfterSeconds === "number"
      ? { retryAfterSeconds: error.retryAfterSeconds }
      : {}),
  };
}

async function postApi<T extends SuccessfulEnvelope>(
  url: string,
  body: unknown,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ChatRequestError(
      fallbackFromPayload(null, response.status || 503),
    );
  }
  if (
    !response.ok ||
    !payload ||
    typeof payload !== "object" ||
    (payload as Record<string, unknown>).ok !== true
  ) {
    throw new ChatRequestError(fallbackFromPayload(payload, response.status));
  }
  return payload as T;
}

function persistentError(fallback: AiFallbackState) {
  return {
    code: fallback.code,
    title: fallback.title,
    message: fallback.message,
    canRetry: fallback.canRetry,
    ...(fallback.retryAfterSeconds === undefined
      ? {}
      : { retryAfterSeconds: fallback.retryAfterSeconds }),
  };
}

function readyProviderState(
  state: RoutineConversationState,
  diagnostics?: ProviderDiagnostics,
): AiProviderState {
  return {
    status: "ready",
    providerId: diagnostics?.provider ?? state.providerState.providerId,
    model: diagnostics?.model ?? state.providerState.model,
    error: null,
  };
}

function composeContext(options: {
  result: DerivedRoutineTurnResult;
  state: RoutineConversationState;
  safety: AssistantSafetyResult;
  plan: ValidatedPlanSummary | null;
  exerciseContext?: unknown;
  assumptions?: readonly string[];
}): ValidatedAssistantResponseContext {
  const allowedNextActions: ValidatedAssistantResponseContext["allowedNextActions"] =
    ["open_guided_form", "browse_exercises"];
  if (options.state.missingFields.length > 0) {
    allowedNextActions.unshift("ask_missing_information");
  }
  if (options.safety.generationAllowed && !options.plan) {
    allowedNextActions.unshift("generate_routine");
  }
  if (!options.safety.generationAllowed) {
    allowedNextActions.unshift("review_safety");
  }
  if (options.plan && options.safety.generationAllowed) {
    allowedNextActions.unshift(
      "show_routine",
      "modify_routine",
      "answer_question",
      "save_routine",
    );
  }
  const parseStatus =
    options.state.missingFields.length > 0
      ? "needs_input"
      : options.safety.generationAllowed
        ? "complete"
        : "unsupported";

  return ComposeAssistantResponseInputDataSchema.parse({
    latestIntent: options.result.intent,
    canonicalDraft: options.state.requestDraft,
    limitationsConfirmation: options.state.limitationsConfirmation,
    missingFields: options.state.missingFields,
    completionPercentage: options.state.completionPercentage,
    parseStatus,
    safetyResult: options.safety,
    focusedQuestionFields: selectFocusedQuestionFields(
      options.state.missingFields,
    ),
    safetyMissingFields: deriveMissingSafetyFields(
      options.state.safety.screeningDraft,
    ),
    safetyAnsweredFields: CONVERSATIONAL_SAFETY_FIELD_VALUES.filter(
      (field) => options.state.safety.screeningDraft[field] !== null,
    ),
    safetyAnsweredCount: safetyAnsweredCount(
      options.state.safety.screeningDraft,
    ),
    validatedPlan: options.plan,
    exerciseContext:
      options.exerciseContext === undefined
        ? null
        : GroundedExerciseResponseContextSchema.parse(options.exerciseContext),
    allowedNextActions: [...new Set(allowedNextActions)],
    assumptions: [...(options.assumptions ?? options.result.assumptions)],
    locale: "es-AR",
  });
}

function requestChanged(left: RoutineRequest, right: RoutineRequest): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function profileRows(state: RoutineConversationState) {
  const draft = state.requestDraft;
  return [
    {
      key: "goal",
      label: REQUIRED_LABELS.goal,
      value: draft.goal ? GOAL_LABELS[draft.goal] : null,
    },
    {
      key: "experience",
      label: REQUIRED_LABELS.experience,
      value: draft.experience ? EXPERIENCE_LABELS[draft.experience] : null,
    },
    {
      key: "daysPerWeek",
      label: REQUIRED_LABELS.daysPerWeek,
      value: draft.daysPerWeek ? `${draft.daysPerWeek} días` : null,
    },
    {
      key: "sessionMinutes",
      label: REQUIRED_LABELS.sessionMinutes,
      value: draft.sessionMinutes ? `${draft.sessionMinutes} minutos` : null,
    },
    {
      key: "trainingLocationOrEquipment",
      label: REQUIRED_LABELS.trainingLocationOrEquipment,
      value:
        draft.availableEquipment.length > 0
          ? exerciseListLabel(draft.availableEquipment)
          : draft.trainingLocation
            ? LOCATION_LABELS[draft.trainingLocation]
            : null,
    },
    {
      key: "limitationsConfirmation",
      label: REQUIRED_LABELS.limitationsConfirmation,
      value:
        safetyAnsweredCount(state.safety.screeningDraft) > 0 &&
        state.limitationsConfirmation === "not_confirmed"
          ? `${safetyAnsweredCount(state.safety.screeningDraft)} de 6 respuestas confirmadas`
          : state.limitationsConfirmation === "confirmed_none"
            ? "Sin dolor ni restricciones declaradas"
            : state.limitationsConfirmation === "confirmed_with_limitations"
              ? "Requiere revisión"
              : null,
    },
  ] as const;
}

export function RoutineChat({
  catalog,
  datasetVersion,
  media,
}: {
  catalog: readonly CatalogExercise[];
  datasetVersion: string;
  media: Readonly<Record<string, ExerciseMedia>>;
}) {
  const router = useRouter();
  const repositoryRef = useRef<RoutineRepository | null>(null);
  const conversationRef = useRef<RoutineConversationState | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [conversation, setConversation] =
    useState<RoutineConversationState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState("Entendiendo tu mensaje…");
  const [fallback, setFallback] = useState<AiFallbackState | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostics | null>(
    null,
  );
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [activeExercise, setActiveExercise] =
    useState<ConversationExerciseTarget | null>(null);
  const [exerciseCard, setExerciseCard] = useState<GroundedExerciseCard | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const desktopProfile = useSyncExternalStore(
    subscribeDesktopProfile,
    isDesktopProfile,
    serverDesktopProfile,
  );
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const inputMetrics = useMemo(() => getUserMessageMetrics(input), [input]);
  const inputExceedsLimit = !inputMetrics.valid;

  const commit = useCallback(async (update: RoutineConversationStateUpdate) => {
    const repository = repositoryRef.current;
    if (!repository) {
      throw new Error("El almacenamiento local todavía no está listo.");
    }
    const next = await repository.updateRoutineConversationState(update);
    conversationRef.current = next;
    setConversation(next);
    return next;
  }, []);

  useEffect(() => {
    let mounted = true;
    const repository = createBrowserRoutineRepository();
    repositoryRef.current = repository;
    void (async () => {
      let state = await repository.loadRoutineConversationState();
      if (state.messages.length === 0) {
        state = await repository.updateRoutineConversationState({
          messages: [createMessage("assistant", INITIAL_MESSAGE)],
        });
      }
      if (state.currentRoutine) {
        const validated = buildValidatedPlanSummary({
          ...state.currentRoutine,
          catalog,
        });
        if (!validated) {
          state = await repository.updateRoutineConversationState({
            currentRoutine: null,
          });
          if (mounted) {
            setGenerationError(
              "La rutina guardada no superó la validación actual. Conservamos tu perfil para regenerarla.",
            );
          }
        }
      }
      const routines = await repository.list();
      if (!mounted) return;
      conversationRef.current = state;
      setConversation(state);
      setActiveDayId(state.currentRoutine?.plan.days[0]?.id ?? null);
      const savedRoutine = state.currentRoutine
        ? routines.find(
            (routine) => routine.id === state.currentRoutine?.plan.id,
          )
        : null;
      setSaved(
        Boolean(
          state.currentRoutine &&
          savedRoutine &&
          matchesSavedSnapshot(state.currentRoutine, savedRoutine),
        ),
      );
      if (state.providerState.status === "error") {
        setFallback({
          ...state.providerState.error,
          action: "guided_form",
        });
      }
    })().catch(() => {
      if (!mounted) return;
      setGenerationError(
        "No pudimos leer el almacenamiento local. Recargá la página antes de continuar.",
      );
    });
    return () => {
      mounted = false;
      requestAbortRef.current?.abort();
    };
  }, [catalog]);

  useEffect(() => {
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [conversation?.messages, loading]);

  useLayoutEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [input]);

  const appendAssistant = useCallback(
    async (
      state: RoutineConversationState,
      content: string,
      options: {
        providerFallback?: AiFallbackState | null;
        pendingSafety?: {
          fields: readonly ConversationalSafetyField[];
          mode?: "confirm" | "describe";
        };
      } = {},
    ) => {
      const message = createMessage("assistant", content);
      const providerFallback = options.providerFallback;
      const next = await commit({
        messages: [...state.messages, message],
        retryMetadata: null,
        providerState: providerFallback
          ? {
              status: "error",
              providerId: state.providerState.providerId,
              model: state.providerState.model,
              error: persistentError(providerFallback),
            }
          : state.providerState.status === "error"
            ? createIdleAiProviderState()
            : state.providerState,
        pendingQuestion: options.pendingSafety
          ? createPendingSafetyQuestion(
              message.id,
              [...options.pendingSafety.fields],
              options.pendingSafety.mode,
            )
          : null,
      });
      if (providerFallback) setFallback(providerFallback);
      return next;
    },
    [commit],
  );

  const requestAssistantResponse = useCallback(
    async (
      context: ValidatedAssistantResponseContext,
      signal: AbortSignal,
    ): Promise<{ message: string; providerError: AiFallbackState | null }> => {
      if (!context.validatedPlan && !context.exerciseContext) {
        return {
          message: composeAssistantFallback(context),
          providerError: null,
        };
      }
      try {
        const payload = await postApi<
          SuccessfulEnvelope & {
            response: unknown;
            fallbackUsed?: boolean;
            providerError?: unknown;
          }
        >("/api/ai/respond", context, signal);
        const response = AssistantResponseSchema.parse(payload.response);
        const providerError = payload.providerError
          ? fallbackFromPayload({ error: payload.providerError })
          : null;
        return { message: response.message, providerError };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        return {
          message: composeAssistantFallback(context),
          providerError:
            error instanceof ChatRequestError
              ? error.fallback
              : fallbackFromPayload(null),
        };
      }
    },
    [],
  );

  const processTurn = useCallback(
    async (
      text: string,
      baseState: RoutineConversationState,
      signal: AbortSignal,
      explicitExerciseTarget: ConversationExerciseTarget | null,
    ) => {
      const pendingAnswer = resolvePendingConversationAnswer(
        text,
        baseState.pendingQuestion,
      );
      if (pendingAnswer.kind === "affirmative") {
        return appendAssistant(
          baseState,
          "Gracias por avisar. Contame cuál de esas situaciones aplica y cómo afecta tu entrenamiento, o revisala en el formulario guiado. No voy a generar la rutina hasta que quede aclarado.",
          {
            pendingSafety: {
              fields: pendingAnswer.fields,
              mode: "describe",
            },
          },
        );
      }

      let interpreted: {
        turn: unknown;
        diagnostics?: ProviderDiagnostics;
      };
      if (pendingAnswer.kind === "negative") {
        interpreted = {
          turn: ParsedRoutineTurnSchema.parse({
            intent: "provide_information",
            requestPatch: {},
            limitationsConfirmation: "unknown",
            safetySignals: [],
            assumptions: [],
          }),
        };
      } else {
        setActivity("Entendiendo tu mensaje…");
        interpreted = await postApi<
          SuccessfulEnvelope & {
            turn: unknown;
            diagnostics?: ProviderDiagnostics;
          }
        >(
          "/api/ai/interpret",
          {
            message: text,
            currentDraft: baseState.requestDraft,
            currentLimitationsConfirmation:
              baseState.limitationsConfirmation,
            locale: "es-AR",
          },
          signal,
        );
      }
      const parsedTurn = reconcileParsedTurnSafety(
        ParsedRoutineTurnSchema.parse(interpreted.turn),
        text,
        { hasCurrentRoutine: Boolean(baseState.currentRoutine) },
      );
      const result = applyParsedRoutineTurn(
        baseState.requestDraft,
        baseState.limitationsConfirmation,
        parsedTurn,
        {
          rawMessage: text,
          screeningDraft: baseState.safety.screeningDraft,
          contextualSafetyPatch:
            pendingAnswer.kind === "negative"
              ? pendingAnswer.patch
              : undefined,
        },
      );
      const safetySignals = [
        ...new Set([...baseState.safety.signals, ...result.safetySignals]),
      ];
      const retainedSafetyAssessment =
        parsedTurn.limitationsConfirmation === "unknown" &&
        Object.keys(parsedTurn.requestPatch).length === 0 &&
        result.safetySignals.length === 0 &&
        baseState.safety.screening
          ? baseState.safety.result
          : null;
      const assistantSafety = deriveAssistantSafetyResult(
        result.limitationsConfirmation,
        safetySignals,
        retainedSafetyAssessment,
        result.screeningDraft,
      );
      const completeRequest = toCompleteRoutineRequest(
        result.requestDraft,
        result.limitationsConfirmation,
      );
      const screening = assistantSafety.generationAllowed
        ? (toCompleteSafetyScreening(result.screeningDraft, safetySignals) ??
          baseState.safety.screening)
        : null;
      const safetyAssessment =
        completeRequest && screening
          ? evaluateRoutineSafety(completeRequest, screening)
          : null;
      if (interpreted.diagnostics) {
        setDiagnostics(interpreted.diagnostics);
      }

      setActivity("Validando el perfil y la seguridad…");
      let working = await commit({
        requestDraft: result.requestDraft,
        limitationsConfirmation: result.limitationsConfirmation,
        safety: {
          signals: safetySignals,
          screeningDraft: result.screeningDraft,
          screening,
          result: safetyAssessment,
        },
        providerState: readyProviderState(baseState, interpreted.diagnostics),
        retryMetadata: null,
        pendingQuestion: null,
      });
      let currentRoutine = working.currentRoutine;
      let deterministicReply: string | null = null;

      if (result.intent === "off_topic") {
        return appendAssistant(working, OFF_TOPIC_REPLY);
      }

      if (
        currentRoutine &&
        result.intent === "modify_routine" &&
        completeRequest &&
        screening
      ) {
        setActivity("Interpretando el cambio sobre tu rutina…");
        const modificationPayload = await postApi<
          SuccessfulEnvelope & { result: unknown }
        >(
          "/api/ai/modify",
          {
            message: text,
            currentRequest: currentRoutine.request,
            plan: buildRoutinePlanContext(currentRoutine.plan, catalog),
            locale: "es-AR",
          },
          signal,
        );
        const modificationResult = RoutineModificationResultSchema.parse(
          modificationPayload.result,
        );
        if (modificationResult.status === "needs_clarification") {
          return appendAssistant(
            working,
            modificationResult.clarificationQuestion ??
              "¿Qué parte de la rutina querés cambiar?",
          );
        }
        if (modificationResult.status === "unsupported") {
          const blockedSignals = [
            ...new Set([
              ...working.safety.signals,
              ...modificationResult.safetySignals,
            ]),
          ];
          working = await commit({
            safety: {
              signals: blockedSignals,
              screeningDraft: working.safety.screeningDraft,
              screening: null,
              result: null,
            },
          });
        } else if (modificationResult.modification) {
          const applied = applyConversationRoutineModification({
            modification: modificationResult.modification,
            plan: currentRoutine.plan,
            request: currentRoutine.request,
            safetyScreening: screening,
            catalog,
            datasetVersion,
            seed: createRoutineSeed(now(), crypto.randomUUID()),
          });
          if (!applied.ok) {
            return appendAssistant(working, applied.message);
          }
          currentRoutine = {
            request: applied.request,
            plan: applied.plan,
            safetyScreening: screening,
            updatedAt: now(),
          };
          working = await commit({
            requestDraft: applied.request,
            currentRoutine,
          });
          deterministicReply = applied.summary;
          setSaved(false);
        }
      } else if (
        currentRoutine &&
        completeRequest &&
        screening &&
        assistantSafety.generationAllowed &&
        Object.keys(parsedTurn.requestPatch).length > 0 &&
        requestChanged(currentRoutine.request, completeRequest)
      ) {
        const applied = applyConversationRoutineModification({
          modification: { kind: "update_request", patch: completeRequest },
          plan: currentRoutine.plan,
          request: currentRoutine.request,
          safetyScreening: screening,
          catalog,
          datasetVersion,
          seed: createRoutineSeed(now(), crypto.randomUUID()),
        });
        if (!applied.ok) {
          return appendAssistant(working, applied.message);
        }
        currentRoutine = {
          request: applied.request,
          plan: applied.plan,
          safetyScreening: screening,
          updatedAt: now(),
        };
        working = await commit({
          requestDraft: applied.request,
          currentRoutine,
        });
        deterministicReply = applied.summary;
        setSaved(false);
      }

      if (
        !currentRoutine &&
        completeRequest &&
        screening &&
        assistantSafety.generationAllowed &&
        safetyAssessment?.allowed
      ) {
        setActivity("Armando y validando tu rutina…");
        const generated = generateRoutineUseCase({
          request: completeRequest,
          safetyScreening: screening,
          catalog,
          datasetVersion,
          seed: createRoutineSeed(now(), crypto.randomUUID()),
        });
        if (!generated.ok) {
          return appendAssistant(
            working,
            `Guardé tu perfil, pero no pude construir una rutina válida todavía: ${generated.message}`,
          );
        }
        currentRoutine = {
          request: completeRequest,
          plan: generated.plan,
          safetyScreening: screening,
          updatedAt: now(),
        };
        working = await commit({ currentRoutine });
        setActiveDayId(generated.plan.days[0]?.id ?? null);
        setSaved(false);
      }

      const validatedPlan = currentRoutine
        ? buildValidatedPlanSummary({
            ...currentRoutine,
            catalog,
          })
        : null;
      if (currentRoutine && !validatedPlan) {
        setGenerationError(
          "La rutina cambió, pero no superó la validación completa. Conservamos el perfil sin mostrar un plan inválido.",
        );
        working = await commit({ currentRoutine: null });
        currentRoutine = null;
      }

      if (deterministicReply) {
        return appendAssistant(working, deterministicReply);
      }

      let exerciseResponseContext: unknown;
      if (
        result.intent === "ask_question" &&
        currentRoutine &&
        assistantSafety.generationAllowed
      ) {
        const resolution = resolveConversationQuestion({
          message: text,
          plan: currentRoutine.plan,
          catalog,
          activeExercise: explicitExerciseTarget ?? activeExercise,
          activeDayId,
        });
        if (resolution.kind === "routine_explanation" && validatedPlan) {
          setActivity("Explicando las decisiones validadas…");
          const explanationPayload = await postApi<
            SuccessfulEnvelope & {
              explanation: unknown;
              fallbackUsed?: boolean;
              providerError?: unknown;
            }
          >(
            "/api/ai/explain",
            { plan: validatedPlan, question: text, locale: "es-AR" },
            signal,
          );
          const explanation = AssistantResponseSchema.parse({
            message: explanationPayload.explanation,
          }).message;
          const providerError = explanationPayload.providerError
            ? fallbackFromPayload({ error: explanationPayload.providerError })
            : null;
          return appendAssistant(working, explanation, { providerFallback: providerError });
        }
        if (resolution.kind === "exercise") {
          setActiveExercise(resolution.target);
          setActivity("Buscando datos en el catálogo validado…");
          const exercisePayload = await postApi<
            SuccessfulEnvelope & { context: unknown; responseContext: unknown }
          >(
            "/api/ai/exercise",
            {
              questionKind: resolution.questionKind,
              target: resolution.target,
              routinePlan: currentRoutine.plan,
              routineRequest: currentRoutine.request,
              requiredAlternativeEquipment:
                resolution.requiredAlternativeEquipment,
            },
            signal,
          );
          exerciseResponseContext = GroundedExerciseResponseContextSchema.parse(
            exercisePayload.responseContext,
          );
          setExerciseCard(exercisePayload.context as GroundedExerciseCard);
        }
      }

      setActivity("Redactando una respuesta breve…");
      const latestState = conversationRef.current ?? working;
      const latestSafety = deriveAssistantSafetyResult(
        latestState.limitationsConfirmation,
        latestState.safety.signals,
        latestState.safety.result,
        latestState.safety.screeningDraft,
      );
      const context = composeContext({
        result,
        state: latestState,
        safety: latestSafety,
        plan: currentRoutine ? validatedPlan : null,
        exerciseContext: exerciseResponseContext,
      });
      const response = await requestAssistantResponse(context, signal);
      return appendAssistant(
        latestState,
        response.message,
        {
          providerFallback: response.providerError,
          ...(context.safetyMissingFields.length > 0
            ? {
                pendingSafety: {
                  fields: context.safetyMissingFields,
                  mode: "confirm" as const,
                },
              }
            : {}),
        },
      );
    },
    [
      activeDayId,
      activeExercise,
      appendAssistant,
      catalog,
      commit,
      datasetVersion,
      requestAssistantResponse,
    ],
  );

  const submitText = useCallback(
    async (
      rawText: string,
      options?: {
        existingUserMessageId?: string;
        explicitExerciseTarget?: ConversationExerciseTarget | null;
      },
    ) => {
      if (!getUserMessageMetrics(rawText).valid) return;
      const text = rawText.trim();
      const base = conversationRef.current;
      if (!text || !base || loading) return;
      setInput("");
      setLoading(true);
      setFallback(null);
      setGenerationError(null);
      setExerciseCard(null);
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;

      let working = base;
      let userMessageId = options?.existingUserMessageId;
      if (!userMessageId) {
        const userMessage = createMessage("user", text);
        userMessageId = userMessage.id;
        working = await commit({
          messages: [...base.messages, userMessage],
          providerState: createIdleAiProviderState(),
          retryMetadata: null,
        });
      }

      try {
        await processTurn(
          text,
          working,
          controller.signal,
          options?.explicitExerciseTarget ?? null,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const state = conversationRef.current ?? working;
        const nextFallback =
          error instanceof ChatRequestError
            ? error.fallback
            : fallbackFromPayload(null);
        const previousAttempt =
          state.retryMetadata?.lastUserMessageId === userMessageId
            ? state.retryMetadata.attemptCount
            : 0;
        await commit({
          providerState: {
            status: "error",
            providerId: state.providerState.providerId,
            model: state.providerState.model,
            error: persistentError(nextFallback),
          },
          retryMetadata: {
            lastUserMessageId: userMessageId,
            failedAt: now(),
            attemptCount: Math.min(previousAttempt + 1, 20),
          },
        });
        setFallback(nextFallback);
      } finally {
        if (requestAbortRef.current === controller) {
          requestAbortRef.current = null;
          setLoading(false);
        }
      }
    },
    [commit, loading, processTurn],
  );

  const retry = useCallback(() => {
    const state = conversationRef.current;
    const metadata = state?.retryMetadata;
    if (!state || !metadata) return;
    const message = state.messages.find(
      (candidate) =>
        candidate.role === "user" &&
        candidate.id === metadata.lastUserMessageId,
    );
    if (!message) return;
    void submitText(message.content, {
      existingUserMessageId: message.id,
    });
  }, [submitText]);

  const saveRoutine = useCallback(async () => {
    const current = conversationRef.current?.currentRoutine;
    if (!current || !repositoryRef.current) return;
    await repositoryRef.current.save(
      current.request,
      current.plan,
      current.safetyScreening,
    );
    setSaved(true);
  }, []);

  const startNewConversation = useCallback(async () => {
    if (loading || !repositoryRef.current) return;

    const confirmed = window.confirm(
      "Se va a borrar la conversación y la rutina activa. Las rutinas guardadas no se borrarán. Querés continuar igual?",
    );
    if (!confirmed) return;

    requestAbortRef.current?.abort();
    setInput("");
    setFallback(null);
    setGenerationError(null);
    setDiagnostics(null);
    setExerciseCard(null);
    setActiveExercise(null);
    setActiveDayId(null);
    setSaved(false);

    try {
      await repositoryRef.current.clearRoutineConversationState();
      const next = await repositoryRef.current.updateRoutineConversationState({
        messages: [createMessage("assistant", INITIAL_MESSAGE)],
      });
      conversationRef.current = next;
      setConversation(next);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    } catch {
      setGenerationError(
        "No pudimos iniciar una conversación nueva. Conservamos el estado actual.",
      );
    }
  }, [loading]);

  const explainExercise = useCallback(
    (target: ConversationExerciseTarget) => {
      const exercise = catalog.find(
        (candidate) => candidate.id === target.exerciseId,
      );
      setActiveExercise(target);
      void submitText(
        `¿Por qué elegiste ${exercise?.name ?? "este ejercicio"}?`,
        { explicitExerciseTarget: target },
      );
    },
    [catalog, submitText],
  );

  const prepareReplacement = useCallback(
    (target: ConversationExerciseTarget) => {
      const exercise = catalog.find(
        (candidate) => candidate.id === target.exerciseId,
      );
      setActiveExercise(target);
      setInput(
        `Cambiame ${exercise?.name ?? "este ejercicio"} por una alternativa compatible`,
      );
      window.setTimeout(() => composerRef.current?.focus(), 0);
    },
    [catalog],
  );

  const rows = useMemo(
    () => (conversation ? profileRows(conversation) : []),
    [conversation],
  );
  const currentRoutine = conversation?.currentRoutine ?? null;
  const pendingSafetyQuestion =
    conversation?.pendingQuestion?.kind === "safety_confirmation"
      ? conversation.pendingQuestion
      : null;
  const assistantSafety = conversation
    ? deriveAssistantSafetyResult(
        conversation.limitationsConfirmation,
        conversation.safety.signals,
        conversation.safety.result,
      )
    : null;
  const showSuggestions =
    Boolean(conversation) &&
    !currentRoutine &&
    !pendingSafetyQuestion &&
    (conversation?.messages.length ?? 0) <= 3;

  if (!conversation) {
    return (
      <div className={[styles.page, "shell"].join(" ")}>
        <div className={styles.loadingPage} role="status">
          <LoaderCircle aria-hidden="true" /> Recuperando tu espacio de trabajo…
        </div>
      </div>
    );
  }

  return (
    <div
      className={[styles.page, "shell"].join(" ")}
      data-testid="routine-chat"
    >
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">Tu entrenador conversacional</p>
          <h1>Armemos una rutina que puedas entender y cambiar.</h1>
          <p>
            Hablá con naturalidad. FORMA estructura el pedido; el motor
            determinista elige y valida cada ejercicio antes de mostrarlo.
          </p>
        </div>
        <Link className="button button-quiet" href="/crear/manual">
          <ClipboardList aria-hidden="true" size={17} /> Usar formulario guiado
        </Link>
      </header>

      <div className={styles.workspace}>
        <section className={styles.chat} aria-labelledby="chat-title">
          <div className={styles.chatTop}>
            <div>
              <span className="eyebrow" id="chat-title">
                Conversación
              </span>
              <strong>FORMA mantiene el contexto validado</strong>
            </div>
            <div className={styles.chatTopActions}>
              <button
                type="button"
                className={styles.newConversation}
                onClick={() => void startNewConversation()}
                disabled={loading}
              >
                <RotateCcw aria-hidden="true" /> Nueva conversación
              </button>
              <span className={styles.statusDot} aria-hidden="true" />
            </div>
          </div>

          <div
            className={styles.thread}
            ref={threadRef}
            role="log"
            aria-label="Mensajes de la conversación"
            aria-live="polite"
            tabIndex={0}
          >
            {conversation.messages.map((message) => (
              <article
                key={message.id}
                className={
                  message.role === "user"
                    ? styles.userMessage
                    : styles.aiMessage
                }
                data-message-role={message.role}
              >
                {message.role === "user" ? (
                  <>
                    <p>{message.content}</p>
                    <span aria-hidden="true">
                      <UserRound />
                    </span>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">
                      <Bot />
                    </span>
                    <p>{message.content}</p>
                  </>
                )}
              </article>
            ))}
            {loading ? (
              <div className={styles.typing} role="status">
                <LoaderCircle aria-hidden="true" /> {activity}
              </div>
            ) : null}
          </div>

          {pendingSafetyQuestion?.mode === "confirm" && !loading ? (
            <div
              className={styles.safetyReplies}
              aria-label="Respuestas rápidas de seguridad"
            >
              <button
                type="button"
                className={styles.safetyClearReply}
                onClick={() => void submitText("No, ninguna")}
              >
                <ShieldCheck aria-hidden="true" /> No, ninguna
              </button>
              <button
                type="button"
                onClick={() => void submitText("Sí, quiero aclarar")}
              >
                <ShieldAlert aria-hidden="true" /> Sí, quiero aclarar
              </button>
            </div>
          ) : null}

          {pendingSafetyQuestion?.mode === "describe" && !loading ? (
            <div className={styles.safetyDescribeAction}>
              <Link href="/crear/manual">
                Revisar estas situaciones en el formulario
              </Link>
            </div>
          ) : null}

          {exerciseCard ? (
            <article
              className={styles.exerciseAnswer}
              data-testid="exercise-answer-card"
            >
              <div className={styles.exerciseAnswerMedia}>
                <ExerciseThumbnail
                  name={
                    exerciseCard.exercise.displayNameEs ??
                    exerciseCard.exercise.displayName
                  }
                  media={media[exerciseCard.exercise.id]}
                />
              </div>
              <div>
                <p className="eyebrow">Datos del catálogo validado</p>
                <h3>
                  {exerciseCard.exercise.displayNameEs ??
                    exerciseCard.exercise.displayName}
                </h3>
                <p>
                  <strong>Foco:</strong>{" "}
                  {exerciseListLabel(exerciseCard.exercise.primaryMuscles)}
                  {exerciseCard.exercise.secondaryMuscles.length > 0
                    ? ` · Secundarios: ${exerciseListLabel(exerciseCard.exercise.secondaryMuscles)}`
                    : ""}
                </p>
                {exerciseCard.routine ? (
                  <p>
                    {exerciseCard.routine.prescription.sets} series ·{" "}
                    {exerciseCard.routine.prescription.repPrescription} reps ·{" "}
                    RIR {exerciseCard.routine.prescription.rir ?? "—"}
                  </p>
                ) : null}
                {exerciseCard.exercise.instructionStepsEs.length > 0 ? (
                  <details>
                    <summary>Ver instrucciones revisadas</summary>
                    <ol>
                      {exerciseCard.exercise.instructionStepsEs.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </details>
                ) : null}
                {exerciseCard.alternatives.length > 0 ? (
                  <details>
                    <summary>Alternativas aprobadas</summary>
                    <ul>
                      {exerciseCard.alternatives.map((alternative) => (
                        <li key={alternative.id}>
                          <Link href={`/ejercicios/${alternative.id}`}>
                            {alternative.displayNameEs ??
                              alternative.displayName}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                <small>
                  Fuente: catálogo local · commit{" "}
                  <code>
                    {exerciseCard.grounding.datasetCommit.slice(0, 12)}
                  </code>
                </small>
              </div>
            </article>
          ) : null}

          {fallback ? (
            <div className={styles.fallback} role="alert">
              <CircleAlert aria-hidden="true" />
              <div>
                <strong>{fallback.title}</strong>
                <p>{fallback.message}</p>
                <div>
                  {fallback.canRetry && conversation.retryMetadata ? (
                    <button type="button" onClick={retry}>
                      <RotateCcw aria-hidden="true" /> Reintentar el último
                      turno
                    </button>
                  ) : null}
                  <Link href="/crear/manual">Continuar con el formulario</Link>
                </div>
              </div>
            </div>
          ) : null}

          {generationError ? (
            <div className={styles.generationError} role="alert">
              <CircleAlert aria-hidden="true" /> {generationError}
            </div>
          ) : null}

          {showSuggestions ? (
            <div
              className={styles.suggestions}
              aria-label="Ideas para responder"
            >
              {SUGGESTIONS.map((suggestion) => (
                <button
                  type="button"
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          ) : null}

          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              if (!loading && !inputExceedsLimit) void submitText(input);
            }}
          >
            <label className={styles.composerField}>
              <span className="sr-only">Mensaje para FORMA</span>
              <textarea
                ref={composerRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-describedby="chat-message-limit"
                aria-invalid={inputExceedsLimit}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!loading && !inputExceedsLimit) void submitText(input);
                  }
                }}
                placeholder={
                  currentRoutine
                    ? "Preguntá por la rutina o pedime un cambio…"
                    : "Ej.: Quiero crecer mis bíceps y entreno cuatro días…"
                }
              />
              <span
                id="chat-message-limit"
                className={
                  inputExceedsLimit
                    ? styles.messageLimitError
                    : styles.messageLimit
                }
              >
                {MESSAGE_COUNT_FORMATTER.format(inputMetrics.words)} de{" "}
                {MESSAGE_COUNT_FORMATTER.format(USER_MESSAGE_LIMITS.words)} palabras ·{" "}
                {MESSAGE_COUNT_FORMATTER.format(inputMetrics.characters)} de{" "}
                {MESSAGE_COUNT_FORMATTER.format(USER_MESSAGE_LIMITS.characters)} caracteres
              </span>
              {inputExceedsLimit ? (
                <span className={styles.limitAlert} role="status">
                  Acortá el mensaje para enviarlo. El texto no se cortó.
                </span>
              ) : null}
            </label>
            {loading ? (
              <button
                type="button"
                onClick={() => requestAbortRef.current?.abort()}
                aria-label="Cancelar respuesta"
              >
                <Square aria-hidden="true" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || inputExceedsLimit}
                aria-label="Enviar mensaje"
              >
                <Send aria-hidden="true" />
              </button>
            )}
          </form>
        </section>

        <aside className={styles.profileColumn}>
          <details
            className={styles.profile}
            open={desktopProfile || mobileProfileOpen}
            onToggle={(event) => {
              if (!desktopProfile) {
                setMobileProfileOpen(event.currentTarget.open);
              }
            }}
          >
            <summary
              aria-disabled={desktopProfile}
              tabIndex={desktopProfile ? -1 : 0}
              onClick={(event) => {
                if (desktopProfile) event.preventDefault();
              }}
            >
              <span>
                <span className="eyebrow">Perfil estructurado</span>
                <strong>Tu punto de partida</strong>
              </span>
              <span data-testid="chat-profile-progress">
                {conversation.completionPercentage}%
              </span>
            </summary>
            <div className={styles.profileBody}>
              <div
                className={styles.progress}
                role="progressbar"
                aria-label="Perfil completo"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={conversation.completionPercentage}
              >
                <span
                  style={{ width: `${conversation.completionPercentage}%` }}
                />
              </div>
              <dl>
                {rows.map((row) => (
                  <div
                    key={row.key}
                    className={
                      row.value ? styles.completeField : styles.missingField
                    }
                  >
                    <dt>{row.label}</dt>
                    <dd>{row.value ?? "Todavía falta"}</dd>
                  </div>
                ))}
                {conversation.requestDraft.focusMuscles.length > 0 ? (
                  <div className={styles.completeField}>
                    <dt>Prioridades</dt>
                    <dd>
                      {conversation.requestDraft.focusMuscles
                        .map(exerciseLabel)
                        .join(", ")}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {conversation.missingFields.length > 0 ? (
                <div className={styles.missing}>
                  <strong>Para generar todavía falta:</strong>
                  <ul>
                    {conversation.missingFields.map((field) => (
                      <li key={field}>{REQUIRED_LABELS[field]}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {assistantSafety ? (
                <div
                  className={
                    assistantSafety.status === "clear"
                      ? styles.safetyClear
                      : styles.safetyReview
                  }
                >
                  {assistantSafety.status === "clear" ? (
                    <ShieldCheck aria-hidden="true" />
                  ) : (
                    <ShieldAlert aria-hidden="true" />
                  )}
                  <div>
                    <strong>
                      {assistantSafety.status === "clear"
                        ? "Confirmación explícita registrada"
                        : "Generación pausada por seguridad"}
                    </strong>
                    <p>
                      {assistantSafety.status === "clear"
                        ? "No detectamos dolor, lesión reciente, síntomas ni restricciones declaradas."
                        : "Revisá las limitaciones. FORMA no evalúa lesiones ni contradice indicaciones profesionales."}
                    </p>
                  </div>
                </div>
              ) : null}

              <Link className={styles.formFallback} href="/crear/manual">
                Revisar todo en el formulario
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </details>

          {diagnostics && process.env.NODE_ENV === "development" ? (
            <details className={styles.diagnostics}>
              <summary>
                <Bug aria-hidden="true" /> Diagnóstico de desarrollo
              </summary>
              <p>
                Proveedor: <code>{diagnostics.provider}</code>
                <br />
                Modelo: <code>{diagnostics.model ?? "sin modelo"}</code>
              </p>
            </details>
          ) : null}
        </aside>

        {currentRoutine ? (
          <div className={styles.inlineRoutine} data-testid="inline-routine">
            {!assistantSafety?.generationAllowed ? (
              <div className={styles.routineSafetyHold} role="status">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>Rutina conservada, acciones pausadas</strong>
                  <p>
                    Podés revisar el plan como referencia, pero guardar, abrir,
                    explicar o modificar queda deshabilitado hasta completar la
                    revisión de seguridad.
                  </p>
                </div>
              </div>
            ) : null}
            <ConversationRoutinePreview
              plan={currentRoutine.plan}
              catalog={catalog}
              media={media}
              activeDayId={activeDayId}
              onActiveDayChange={setActiveDayId}
              saved={saved}
              actions={
                assistantSafety?.generationAllowed
                  ? {
                      onSave: () => void saveRoutine(),
                      onOpenRoutine: () => router.push("/rutina"),
                      onExplainRoutine: () =>
                        void submitText("¿Por qué organizaste así mi rutina?"),
                      onExplainExercise: explainExercise,
                      onReplaceExercise: prepareReplacement,
                    }
                  : undefined
              }
            />
          </div>
        ) : null}
      </div>

      <footer className={styles.trustNote}>
        <ShieldCheck aria-hidden="true" />
        <p>
          La IA interpreta y redacta; nunca elige ejercicios ni aprueba
          seguridad. El catálogo local, las reglas y el validador siguen siendo
          la fuente de verdad.{" "}
          <Link href="/ejercicios">Explorar ejercicios</Link>
          <ExternalLink aria-hidden="true" />
        </p>
      </footer>
    </div>
  );
}
