import {
  ComposeAssistantResponseInputDataSchema,
  type ValidatedAssistantResponseContext,
} from "../../ai/schemas/assistant-response";
import type { RequiredRoutineField } from "../../domain/profile/routine-draft";
import { selectFocusedQuestionFields } from "./routine-turn-state";

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
  const questions = focused.map((field) => QUESTION_COPY[field]).join(" ");

  if (context.latestIntent === "greeting") {
    return questions.length > 0
      ? `Hola. Te ayudo a armar una rutina que después podés revisar y editar. ${questions}`
      : "Hola. Contame cómo querés entrenar y voy a ordenar tus preferencias paso a paso.";
  }

  const acknowledged = context.canonicalDraft.focusMuscles[0]
    ? `Registré que querés priorizar ${context.canonicalDraft.focusMuscles.join(", ")}.`
    : context.canonicalDraft.daysPerWeek
      ? `Registré que querés entrenar ${context.canonicalDraft.daysPerWeek} días por semana.`
      : "Perfecto, guardé lo que me contaste.";
  return questions.length > 0
    ? `${acknowledged} ${questions}`
    : acknowledged;
}
