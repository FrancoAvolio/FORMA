import { normalizeDomainText } from "../../domain/exercises/normalization";

const DOMAIN_TERMS = [
  "rutina",
  "entren",
  "gimnasio",
  "gym",
  "ejercicio",
  "musculo",
  "hipertrof",
  "fuerza",
  "resistencia",
  "cardio",
  "movilidad",
  "calentamiento",
  "estiramiento",
  "correr",
  "running",
  "trotar",
  "bicicleta",
  "natacion",
  "yoga",
  "fitness",
  "objetivo",
  "nivel",
  "principiante",
  "intermedio",
  "avanzado",
  "prioriz",
  "serie",
  "repeticion",
  "sesion",
  "dias",
  "seman",
  "minuto",
  "equipamiento",
  "equipo",
  "mancuerna",
  "barra",
  "polea",
  "maquina",
  "peso corporal",
  "espalda",
  "biceps",
  "triceps",
  "pecho",
  "hombro",
  "pierna",
  "glute",
  "cuadricep",
  "isquiotibial",
  "gemelo",
  "abdomen",
  "abdominal",
  "core",
  "press",
  "remo",
  "curl",
  "sentadilla",
  "peso muerto",
  "dominada",
  "dolor",
  "duele",
  "lesion",
  "operacion",
  "cirugia",
  "restriccion",
  "sintoma",
  "medica",
  "profesional",
] as const;

const NON_TRAINING_TASK_TERMS = [
  "pizza",
  "hamburguesa",
  "cocinar",
  "cocina",
  "receta",
  "comida",
  "alimentacion",
  "dieta",
  "nutricion",
  "parrilla",
  "codigo",
  "programar",
  "politica",
  "presidente",
  "viaje",
  "vuelo",
  "hotel",
  "clima",
  "chiste",
  "cancion",
  "pelicula",
] as const;

const BENIGN_SHORT_MESSAGES = /^(?:hola|buenas|hey|gracias|ok|dale|si|no|perfecto|listo)$/u;
const GREETING = /^(?:hola|buenas|buen dia|buenas tardes|buenas noches|hey)(?:\s+forma|\s+bro)?$/u;
const SHORT_SAFETY_REPLY = /^(?:no|nop|nunca|nada|ningun|ninguna)\b/u;

function containsTerm(text: string, term: string): boolean {
  return term.includes(" ")
    ? text.includes(term)
    : text.split(" ").some((word) => word.includes(term));
}

/**
 * Conservative domain gate for the conversational entry point. It rejects
 * clearly unrelated requests while allowing short acknowledgements and any
 * message with training or safety vocabulary. The model still extracts the
 * allowed facts; it never decides whether an unrelated request is accepted.
 */
export function isClearlyOffTopicMessage(message: string): boolean {
  const normalized = normalizeDomainText(message);
  if (!normalized || BENIGN_SHORT_MESSAGES.test(normalized) || GREETING.test(normalized)) {
    return false;
  }

  const hasExplicitNonTrainingTask = NON_TRAINING_TASK_TERMS.some((term) =>
    containsTerm(normalized, term),
  );
  if (hasExplicitNonTrainingTask) return true;

  const hasTrainingTerm = DOMAIN_TERMS.some((term) => containsTerm(normalized, term));
  if (hasTrainingTerm || SHORT_SAFETY_REPLY.test(normalized)) return false;

  return normalized.split(" ").length >= 3;
}

export const OFF_TOPIC_REPLY =
  "Puedo ayudarte con rutinas, ejercicios, equipamiento y cambios sobre tu plan. ¿Qué objetivo o entrenamiento querés trabajar?";
