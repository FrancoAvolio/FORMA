import {
  ComposeAssistantResponseInputDataSchema,
  type ValidatedAssistantResponseContext,
} from "../../ai/schemas/assistant-response";
import type { RequiredRoutineField } from "../../domain/profile/routine-draft";
import {
  CONVERSATIONAL_SAFETY_FIELD_LABELS,
} from "../../domain/safety/conversational-screening";
import { selectFocusedQuestionFields } from "./routine-turn-state";
import { OFF_TOPIC_REPLY } from "./domain-relevance";

const QUESTION_COPY: Record<RequiredRoutineField, string> = {
  limitationsConfirmation:
    "¿Tenés dolor, una lesión reciente, síntomas o alguna restricción profesional para entrenar?",
  goal: "¿Cuál es tu objetivo principal: ganar músculo, fuerza, resistencia o estado físico general?",
  daysPerWeek: "¿Cuántos días por semana querés entrenar?",
  experience: "¿Cuál es tu nivel actual: principiante, intermedio o avanzado?",
  sessionMinutes: "¿Cuánto tiempo tenés para cada sesión?",
  trainingLocationOrEquipment:
    "¿Dónde vas a entrenar y con qué equipamiento contás?",
};

const GOAL_COPY = {
  hypertrophy: "hipertrofia",
  strength: "fuerza",
  general_fitness: "estado físico general",
  muscular_endurance: "resistencia muscular",
} as const;

const EXPERIENCE_COPY = {
  beginner: "nivel principiante",
  intermediate: "nivel intermedio",
  advanced: "nivel avanzado",
} as const;

const MUSCLE_COPY: Readonly<Record<string, string>> = {
  back: "espalda",
  lats: "dorsales",
  chest: "pecho",
  shoulders: "hombros",
  biceps: "bíceps",
  triceps: "tríceps",
  legs: "piernas",
  quadriceps: "cuádriceps",
  quads: "cuádriceps",
  hamstrings: "isquiotibiales",
  glutes: "glúteos",
  calves: "gemelos",
  core: "zona media",
  abs: "abdominales",
};

const EQUIPMENT_COPY: Readonly<Record<string, string>> = {
  body_weight: "peso corporal",
  dumbbell: "mancuernas",
  barbell: "barra",
  cable: "poleas",
  machine: "máquinas",
  smith_machine: "máquina Smith",
  kettlebell: "pesas rusas",
  resistance_band: "bandas",
  bench: "banco",
  pull_up_bar: "barra de dominadas",
};

const COMPLETE_SAFETY_EXAMPLE =
  "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.";

function joinedList(values: readonly string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  const last = values.at(-1) ?? "";
  const conjunction = /^[ií]/u.test(last) ? "e" : "y";
  return `${values.slice(0, -1).join(", ")} ${conjunction} ${last}`;
}

function safetyFollowUp(context: ValidatedAssistantResponseContext): string {
  const missing = context.safetyMissingFields.map(
    (field) => CONVERSATIONAL_SAFETY_FIELD_LABELS[field],
  );
  if (missing.length === 0) return QUESTION_COPY.limitationsConfirmation;

  const answered = context.safetyAnsweredFields.map(
    (field) => CONVERSATIONAL_SAFETY_FIELD_LABELS[field],
  );
  const question = `Para completar la revisión, confirmame también si tenés ${joinedList(missing)}.`;
  if (answered.length === 0) {
    return `${question} Si todo es negativo, podés responder: “${COMPLETE_SAFETY_EXAMPLE}”`;
  }
  return `Entendido: registré que no declaraste ${joinedList(answered)}. ${question}`;
}

function profileAcknowledgement(
  context: ValidatedAssistantResponseContext,
): string {
  const draft = context.canonicalDraft;
  const facts: string[] = [];
  if (draft.goal) facts.push(`objetivo de ${GOAL_COPY[draft.goal]}`);
  if (draft.experience) facts.push(EXPERIENCE_COPY[draft.experience]);
  if (draft.daysPerWeek) facts.push(`${draft.daysPerWeek} días por semana`);
  if (draft.sessionMinutes) {
    facts.push(`sesiones de ${draft.sessionMinutes} minutos`);
  }
  if (draft.trainingLocation === "commercial_gym") {
    facts.push("entrenamiento en gimnasio comercial");
  } else if (draft.trainingLocation === "home") {
    facts.push("entrenamiento en casa");
  } else if (draft.trainingLocation === "custom") {
    facts.push("un espacio de entrenamiento personalizado");
  }
  if (draft.availableEquipment.length > 0) {
    facts.push(
      `equipamiento: ${joinedList(
        draft.availableEquipment.map(
          (item) => EQUIPMENT_COPY[item] ?? item,
        ),
      )}`,
    );
  }
  if (draft.focusMuscles.length > 0) {
    facts.push(
      `prioridad en ${joinedList(
        draft.focusMuscles.map((item) => MUSCLE_COPY[item] ?? item),
      )}`,
    );
  }

  return facts.length > 0
    ? `Registré ${joinedList(facts)}.`
    : "Perfecto, guardé lo que me contaste.";
}

function allowed(
  context: ValidatedAssistantResponseContext,
  action: ValidatedAssistantResponseContext["allowedNextActions"][number],
): boolean {
  return context.allowedNextActions.includes(action);
}

function composeExerciseAnswer(
  context: ValidatedAssistantResponseContext,
): string | null {
  const exercise = context.exerciseContext;
  if (!exercise) return null;

  const secondary =
    exercise.secondaryMuscles.length > 0
      ? ` También involucra ${exercise.secondaryMuscles.join(", ")}.`
      : "";
  const equipment =
    exercise.equipment.length > 0
      ? ` Se realiza con ${exercise.equipment.join(", ")}.`
      : "";
  const reason = exercise.selectionReasons[0]
    ? ` En tu rutina está porque ${exercise.selectionReasons[0].toLocaleLowerCase("es-AR")}.`
    : "";
  const instruction = exercise.instructions[0]
    ? ` Para hacerlo: ${exercise.instructions[0]}`
    : "";

  return `${exercise.displayName} trabaja principalmente ${exercise.primaryTarget}.${secondary}${equipment}${reason}${instruction}`;
}

/** Contextual, provider-free response used whenever model phrasing fails. */
export function composeAssistantFallback(
  untrustedContext: ValidatedAssistantResponseContext,
): string {
  const context = ComposeAssistantResponseInputDataSchema.parse(
    untrustedContext,
  );

  if (context.latestIntent === "off_topic") {
    return OFF_TOPIC_REPLY;
  }

  if (
    context.safetyResult.status === "unsupported" ||
    context.parseStatus === "unsupported"
  ) {
    const next = allowed(context, "browse_exercises")
      ? " Podés seguir explorando el catálogo de ejercicios."
      : allowed(context, "open_guided_form")
        ? " Podés revisar y corregir tus restricciones en el formulario."
        : " Conservamos tu progreso para que puedas revisar las restricciones.";
    return `Este pedido necesita más cuidado. FORMA no puede evaluar lesiones ni reemplazar una indicación profesional, así que no voy a generar una rutina con estos datos.${next}`;
  }

  if (context.latestIntent === "ask_question") {
    const groundedAnswer = composeExerciseAnswer(context);
    if (groundedAnswer) return groundedAnswer;
    if (context.validatedPlan) {
      return `${context.validatedPlan.title} fue construido y validado por el motor determinístico. Decime qué día o ejercicio querés que te explique.`;
    }
    return "Puedo explicarte una elección cuando identifiquemos el ejercicio o la parte de la rutina que querés revisar.";
  }

  if (context.validatedPlan) {
    const days = context.validatedPlan.days.length;
    const duration = Math.max(
      ...context.validatedPlan.days.map((day) => day.estimatedMinutes),
    );
    return `Listo. Armé ${context.validatedPlan.title}, una rutina validada de ${days} días con sesiones de hasta ${duration} minutos. Podés revisarla y seguir pidiéndome cambios desde acá.`;
  }

  if (context.parseStatus === "complete") {
    return "Ya tengo los datos esenciales y la validación de seguridad necesaria. Ahora puedo generar tu rutina con el motor determinístico.";
  }

  const focused =
    context.focusedQuestionFields.length > 0
      ? context.focusedQuestionFields
      : selectFocusedQuestionFields(context.missingFields);
  const questions =
    context.safetyMissingFields.length > 0
      ? safetyFollowUp(context)
      : focused.map((field) => QUESTION_COPY[field]).join(" ");

  if (context.latestIntent === "greeting") {
    return questions.length > 0
      ? `Hola. Te ayudo a armar una rutina que después podés revisar y editar. ${questions}`
      : "Hola. Contame cómo querés entrenar y voy a ordenar tus preferencias paso a paso.";
  }

  const acknowledged = profileAcknowledgement(context);
  return questions.length > 0
    ? `${acknowledged} ${questions}`
    : acknowledged;
}
