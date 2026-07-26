import type { RoutineRequest } from "../profile/routine-request";
import { normalizeDomainText } from "../exercises/normalization";
import {
  detectSafetyReasonCodes,
  UNSUPPORTED_TEXT_REASON_CODES,
} from "./detect-safety-text";
import type {
  SafetyAssessment,
  SafetyReasonCode,
  SafetyScreening,
} from "./schemas";

const SCREENING_RULES: ReadonlyArray<{
  key: Exclude<keyof SafetyScreening, "confirmedCurrentStatus">;
  code: SafetyReasonCode;
}> = [
  { key: "painDuringMovement", code: "PAIN_DURING_MOVEMENT" },
  { key: "recentInjury", code: "RECENT_INJURY" },
  { key: "recentOperation", code: "RECENT_OPERATION" },
  { key: "medicalRestriction", code: "MEDICAL_RESTRICTION" },
  { key: "symptomsDuringExercise", code: "SYMPTOMS_DURING_EXERCISE" },
  {
    key: "professionalInstructionsAffectTraining",
    code: "PROFESSIONAL_INSTRUCTIONS",
  },
];

function requestSafetyText(request: RoutineRequest): string {
  return normalizeDomainText(
    [...request.limitations, request.notes ?? ""].filter(Boolean).join(" "),
  );
}

export function evaluateRoutineSafety(
  request: RoutineRequest,
  screening: SafetyScreening,
): SafetyAssessment {
  if (!screening.confirmedCurrentStatus) {
    return {
      allowed: false,
      classification: "confirmation_required",
      reasonCodes: ["STATUS_NOT_CONFIRMED"],
      message:
        "Antes de generar la rutina, confirmá si tenés dolor, una lesión reciente, una operación, síntomas o indicaciones profesionales que afecten tu entrenamiento.",
    };
  }

  const hasExplicitMovementRestrictions =
    request.excludedExercises.length > 0 ||
    request.excludedMovementPatterns.length > 0;
  const screeningReasons = SCREENING_RULES.filter(({ key }) => {
    if (
      key === "professionalInstructionsAffectTraining" &&
      hasExplicitMovementRestrictions
    ) {
      return false;
    }
    return screening[key];
  }).map(({ code }) => code);

  if (screeningReasons.length > 0) {
    return {
      allowed: false,
      classification: "professional_guidance_required",
      reasonCodes: screeningReasons,
      message:
        "Este pedido necesita más cuidado. FORMA no puede evaluar lesiones ni reemplazar una indicación profesional. Podés seguir explorando ejercicios o editar tus restricciones cuando tengas indicaciones claras sobre qué movimientos evitar.",
    };
  }

  const textReasons = detectSafetyReasonCodes(requestSafetyText(request));
  const unsupportedReasons = textReasons.filter((code) =>
    UNSUPPORTED_TEXT_REASON_CODES.has(code),
  );

  if (unsupportedReasons.length > 0) {
    return {
      allowed: false,
      classification: "unsupported_request",
      reasonCodes: unsupportedReasons,
      message:
        "Este pedido está fuera del alcance de FORMA. No generamos planes médicos, de rehabilitación ni para situaciones que requieren evaluación profesional. Tu información puede conservarse para que edites las restricciones o explores ejercicios.",
    };
  }

  const reviewReasons = textReasons.filter(
    (code) => !UNSUPPORTED_TEXT_REASON_CODES.has(code),
  );
  if (reviewReasons.length > 0) {
    return {
      allowed: false,
      classification: "professional_guidance_required",
      reasonCodes: reviewReasons,
      message:
        "El texto describe dolor, síntomas o una restricción vigente. FORMA no puede contradecir esa información aunque el cuestionario figure sin alertas. Revisá las respuestas y buscá orientación profesional antes de generar.",
    };
  }

  return {
    allowed: true,
    classification: "eligible",
    reasonCodes: [],
    message: screening.professionalInstructionsAffectTraining
      ? "La confirmación de seguridad está completa y las indicaciones profesionales se expresaron como movimientos o ejercicios concretos a evitar."
      : "La confirmación de seguridad está completa. La rutina puede generarse respetando tus restricciones explícitas.",
  };
}
