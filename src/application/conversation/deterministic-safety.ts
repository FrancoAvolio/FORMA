import { AssistantSafetyResultSchema } from "../../ai/schemas/assistant-response";
import {
  ParsedRoutineTurnSchema,
  type ParsedRoutineTurn,
  type RoutineRequestPatch,
} from "../../ai/schemas/routine-request";
import {
  SafetySignalsListSchema,
  type SafetySignalSchema,
} from "../../ai/schemas/safety";
import type { LimitationsConfirmation } from "../../domain/profile/routine-draft";
import {
  detectLimitationsDeclaration,
  detectSafetyReasonCodes,
} from "../../domain/safety/detect-safety-text";
import type {
  SafetyAssessment,
  SafetyReasonCode,
} from "../../domain/safety/schemas";
import type { z } from "zod";

type SafetySignal = z.output<typeof SafetySignalSchema>;
export type AssistantSafetyResult = z.output<typeof AssistantSafetyResultSchema>;

type PatchField = keyof RoutineRequestPatch;

const PROFILE_FIELD_EVIDENCE: Readonly<Record<PatchField, RegExp>> = {
  goal:
    /\b(?:objetivo|hipertrofi\w*|ganar (?:masa|musculo)|crecer|fuerza|resistencia muscular|estado fisico|acondicionamiento|fitness general)\b/u,
  experience: /\b(?:experiencia|nivel|principiante|intermedio|avanzado)\b/u,
  daysPerWeek:
    /\b(?:(?:un|uno|dos|tres|cuatro|cinco|seis|[1-6])\s+(?:dias?|veces)|(?:dias?|veces)\s+(?:por|a la)\s+semana|semanal)\b/u,
  sessionMinutes: /\b(?:minutos?|horas?|sesion|duracion|tiempo)\b/u,
  trainingLocation:
    /\b(?:gimnasio|gym|casa|hogar|domicilio|lugar|ubicacion|entreno en|entrenar en)\b/u,
  availableEquipment:
    /\b(?:equipo|equipamiento|material|mancuernas?|barra|barbell|poleas?|cables?|maquinas?|smith|kettlebells?|pesas? rusas?|bandas?|banco|peso corporal)\b/u,
  focusMuscles:
    /\b(?:prioriz|enfoc|pecho|espalda|dorsal|dorsales|hombros?|biceps|triceps|piernas?|gluteos?|cuadriceps|isquiotibiales|gemelos|pantorrillas|antebrazos?|abdominales|core)\b/u,
  excludedExercises:
    /\b(?:evit|exclu|no quiero (?:hacer|incluir)|sin hacer|sacar?|sacame|quit|elimin)\b/u,
  excludedMovementPatterns:
    /\b(?:evit|exclu|no quiero (?:hacer|incluir)|sin hacer)\b.*\b(?:empuje|tiron|traccion|sentadilla|bisagra|zancada|estocada|acarreo|core|aislamiento|cardio)\b/u,
  preferredExercises:
    /\b(?:prefier|preferid|quiero incluir|quiero hacer|me gusta)\b/u,
  limitations:
    /\b(?:dolor|lesion|operacion|cirugia|restriccion|limitacion|sintoma|indicacion profesional|rehabilit)\b/u,
  notes: /\b(?:nota|aclaracion|tene en cuenta|ten en cuenta|anota|recorda)\b/u,
};

function reconcileRequestPatch(
  requestPatch: RoutineRequestPatch,
  rawMessage: string,
  declaration: ReturnType<typeof detectLimitationsDeclaration>,
): RoutineRequestPatch {
  const normalized = rawMessage
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const entries = Object.entries(requestPatch).filter(([field]) => {
    if (field === "limitations" && declaration === "no_limitations") {
      return false;
    }
    return PROFILE_FIELD_EVIDENCE[field as PatchField].test(normalized);
  });
  return Object.fromEntries(entries) as RoutineRequestPatch;
}

const REASON_TO_SIGNAL: Partial<Record<SafetyReasonCode, SafetySignal>> = {
  PAIN_DURING_MOVEMENT: "pain_during_movement",
  RECENT_INJURY: "recent_injury",
  RECENT_OPERATION: "recent_operation",
  MEDICAL_RESTRICTION: "medical_restriction",
  SYMPTOMS_DURING_EXERCISE: "symptoms_during_exercise",
  PROFESSIONAL_INSTRUCTIONS: "professional_instruction",
  ACUTE_INJURY_REQUEST: "recent_injury",
  REHABILITATION_REQUEST: "rehabilitation_request",
  POSTOPERATIVE_REQUEST: "recent_operation",
  DIAGNOSIS_REQUEST: "diagnosis_request",
  PREGNANCY_SPECIFIC_REQUEST: "pregnancy_specific",
  MINOR_REQUEST: "minor",
  COMPLEX_MEDICAL_REQUEST: "complex_medical_condition",
  MEDICATION_REQUEST: "medication_advice",
  SUPPLEMENT_REQUEST: "supplement_advice",
  EXTREME_WEIGHT_LOSS_REQUEST: "extreme_weight_loss",
  EATING_DISORDER_REQUEST: "eating_disorder_related",
};

export function detectDeterministicSafetySignals(message: string): SafetySignal[] {
  return SafetySignalsListSchema.parse([
    ...new Set(
      detectSafetyReasonCodes(message).flatMap((reason) => {
        const signal = REASON_TO_SIGNAL[reason];
        return signal ? [signal] : [];
      }),
    ),
  ]);
}

/**
 * A model may add a conservative signal, but it cannot grant an all-clear or
 * delete deterministic evidence found in the raw turn. A strong all-clear
 * found in raw text discards model-only false positives from negated terms.
 */
export function reconcileParsedTurnSafety(
  untrustedTurn: ParsedRoutineTurn,
  rawMessage: string,
  options: { hasCurrentRoutine?: boolean } = {},
): ParsedRoutineTurn {
  const turn = ParsedRoutineTurnSchema.parse(untrustedTurn);
  const deterministicSignals = detectDeterministicSafetySignals(rawMessage);
  const deterministicDeclaration = detectLimitationsDeclaration(rawMessage);
  const requestPatch = reconcileRequestPatch(
    turn.requestPatch,
    rawMessage,
    deterministicDeclaration,
  );
  const safetySignals = SafetySignalsListSchema.parse(
    deterministicDeclaration === "no_limitations" &&
      deterministicSignals.length === 0
      ? []
      : [...new Set([...deterministicSignals, ...turn.safetySignals])],
  );
  const limitationsConfirmation =
    deterministicDeclaration === "has_limitations"
      ? "has_limitations"
      : deterministicDeclaration === "no_limitations"
        ? "no_limitations"
        : turn.limitationsConfirmation === "has_limitations"
          ? "has_limitations"
          : "unknown";
  const intent =
    safetySignals.length > 0
      ? "unsupported"
      : options.hasCurrentRoutine === false &&
          (Object.keys(requestPatch).length > 0 ||
            limitationsConfirmation !== "unknown")
        ? "provide_information"
        : turn.intent;

  return ParsedRoutineTurnSchema.parse({
    ...turn,
    intent,
    requestPatch,
    limitationsConfirmation,
    safetySignals,
  });
}

export function deriveAssistantSafetyResult(
  confirmation: LimitationsConfirmation,
  safetySignals: readonly SafetySignal[],
  assessment: SafetyAssessment | null = null,
): AssistantSafetyResult {
  const signals = SafetySignalsListSchema.parse(safetySignals);
  if (signals.length > 0) {
    return { status: "unsupported", signals, generationAllowed: false };
  }
  if (confirmation === "confirmed_none") {
    return { status: "clear", signals: [], generationAllowed: true };
  }
  if (
    confirmation !== "not_confirmed" &&
    assessment?.allowed === true &&
    assessment.classification === "eligible" &&
    assessment.reasonCodes.length === 0
  ) {
    return { status: "clear", signals: [], generationAllowed: true };
  }
  return { status: "needs_review", signals: [], generationAllowed: false };
}

/**
 * A previous conversational warning can be cleared only by an explicit manual
 * correction after the complete domain screening is eligible. This avoids a
 * permanent dead end without letting a partial form or model output erase it.
 */
export function resolveSafetySignalsAfterManualReview(
  safetySignals: readonly SafetySignal[],
  assessment: SafetyAssessment,
  correctionConfirmed: boolean,
): SafetySignal[] {
  const signals = SafetySignalsListSchema.parse(safetySignals);
  const eligible =
    assessment.allowed &&
    assessment.classification === "eligible" &&
    assessment.reasonCodes.length === 0;
  return correctionConfirmed && eligible ? [] : [...signals];
}
