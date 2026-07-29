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
import { normalizeEquipment } from "../../domain/exercises/normalization";
import {
  deriveConversationalSafetyStatus,
  type ConversationalSafetyScreeningDraft,
} from "../../domain/safety/conversational-screening";
import type { z } from "zod";

type SafetySignal = z.output<typeof SafetySignalSchema>;
export type AssistantSafetyResult = z.output<typeof AssistantSafetyResultSchema>;

type PatchField = keyof RoutineRequestPatch;

const SPANISH_NUMBERS: Readonly<Record<string, number>> = {
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

const CANONICAL_EQUIPMENT = new Set([
  "body_weight",
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "smith_machine",
  "bench",
  "pull_up_bar",
  "dip_bars",
  "barbell_rack",
  "preacher_bench",
  "hyperextension_bench",
  "band_anchor",
  "glute_ham_developer",
  "stability_ball",
  "step_platform",
  "resistance_band",
  "kettlebell",
]);

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

function extractDeterministicRequestPatch(
  normalized: string,
): RoutineRequestPatch {
  const patch: Record<string, unknown> = {};
  if (/\b(?:hipertrofi\w*|ganar (?:masa|musculo)|crecer)\b/u.test(normalized)) {
    patch.goal = "hypertrophy";
  } else if (/\bfuerza\b/u.test(normalized)) {
    patch.goal = "strength";
  } else if (/\bresistencia muscular\b/u.test(normalized)) {
    patch.goal = "muscular_endurance";
  } else if (/\b(?:estado fisico|fitness general)\b/u.test(normalized)) {
    patch.goal = "general_fitness";
  }

  const experience = normalized.match(
    /\b(principiante|intermedio|avanzado)\b/u,
  )?.[1];
  if (experience) {
    patch.experience =
      experience === "principiante"
        ? "beginner"
        : experience === "intermedio"
          ? "intermediate"
          : "advanced";
  }

  const days = normalized.match(
    /\b(\d|un|uno|una|dos|tres|cuatro|cinco|seis)\s+(?:dias?|veces)\b/u,
  );
  if (days?.[1]) {
    const value = Number(days[1]) || SPANISH_NUMBERS[days[1]];
    if (value >= 1 && value <= 6) patch.daysPerWeek = value;
  }

  const minutes = normalized.match(/\b(\d{1,3})\s*minutos?\b/u);
  const hours = normalized.match(
    /\b(\d|un|uno|una|dos)\s*horas?\b/u,
  );
  if (minutes?.[1]) {
    patch.sessionMinutes = Number(minutes[1]);
  } else if (hours?.[1]) {
    const value = Number(hours[1]) || SPANISH_NUMBERS[hours[1]];
    if (value >= 1 && value <= 2) patch.sessionMinutes = value * 60;
  }

  if (/\b(?:gimnasio|gym)\b/u.test(normalized)) {
    patch.trainingLocation = "commercial_gym";
  } else if (/\b(?:casa|hogar|domicilio)\b/u.test(normalized)) {
    patch.trainingLocation = "home";
  }

  const equipmentMentions: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bmancuernas?\b/u, "dumbbell"],
    [/\bbarra de dominadas\b/u, "pull_up_bar"],
    [/\bbarra\b/u, "barbell"],
    [/\b(?:poleas?|cables?)\b/u, "cable"],
    [/\bmaquinas?\b/u, "machine"],
    [/\bsmith\b/u, "smith_machine"],
    [/\b(?:kettlebells?|pesas? rusas?)\b/u, "kettlebell"],
    [/\bbandas?\b/u, "resistance_band"],
    [/\bbanco\b/u, "bench"],
    [/\bpeso corporal\b/u, "body_weight"],
  ];
  const equipment = equipmentMentions
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, value]) => value);
  if (equipment.length > 0) {
    patch.availableEquipment = [...new Set(equipment)];
  }

  if (/\b(?:prioriz|enfoc|crecer|ganar)\w*\b/u.test(normalized)) {
    const muscles: ReadonlyArray<readonly [RegExp, string]> = [
      [/\bbiceps?\b/u, "biceps"],
      [/\b(?:espalda|dorsales?)\b/u, "back"],
      [/\bpecho\b/u, "chest"],
      [/\bhombros?\b/u, "shoulders"],
      [/\btriceps?\b/u, "triceps"],
      [/\b(?:piernas?|cuadriceps)\b/u, "legs"],
      [/\bgluteos?\b/u, "glutes"],
    ];
    const focus = muscles
      .filter(([pattern]) => pattern.test(normalized))
      .map(([, value]) => value);
    if (focus.length > 0) patch.focusMuscles = [...new Set(focus)];
  }

  return patch as RoutineRequestPatch;
}

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
  const reconciled: Record<string, unknown> = {};
  for (const [field, rawValue] of Object.entries(requestPatch)) {
    const patchField = field as PatchField;
    if (
      (field === "limitations" && declaration === "no_limitations") ||
      !PROFILE_FIELD_EVIDENCE[patchField].test(normalized)
    ) {
      continue;
    }

    if (field === "goal") {
      const explicitGoal = normalized.match(
        /\b(?:hipertrofi\w*|ganar (?:masa|musculo)|crecer(?: musculo)?)\b/u,
      )
        ? "hypertrophy"
        : normalized.match(/\bfuerza\b/u)
          ? "strength"
          : normalized.match(/\bresistencia muscular\b/u)
            ? "muscular_endurance"
            : normalized.match(/\b(?:estado fisico|fitness general)\b/u)
              ? "general_fitness"
              : null;
      if (explicitGoal) reconciled[field] = explicitGoal;
      continue;
    }

    if (field === "trainingLocation") {
      const explicitLocation = /\b(?:gimnasio|gym)\b/u.test(normalized)
        ? "commercial_gym"
        : /\b(?:casa|hogar|domicilio)\b/u.test(normalized)
          ? "home"
          : null;
      if (explicitLocation) reconciled[field] = explicitLocation;
      continue;
    }

    if (field === "availableEquipment" && Array.isArray(rawValue)) {
      if (
        /\b(?:gimnasio|gym)\b.*\b(?:completo|commercial|comercial)\b/u.test(
          normalized,
        ) ||
        /\b(?:equipo|equipamiento)\b\s+(?:completo|disponible|total)\b/u.test(
          normalized,
        )
      ) {
        continue;
      }
      const canonical = rawValue
        .map(normalizeEquipment)
        .filter((item) => CANONICAL_EQUIPMENT.has(item));
      if (canonical.length > 0) reconciled[field] = canonical;
      continue;
    }

    reconciled[field] = rawValue;
  }
  const deterministicPatch = extractDeterministicRequestPatch(normalized);
  return {
    ...reconciled,
    ...deterministicPatch,
    ...(reconciled.focusMuscles
      ? { focusMuscles: reconciled.focusMuscles }
      : {}),
  } as RoutineRequestPatch;
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
 * Deterministic evidence from the raw turn is authoritative. Model labels may
 * enrich a turn that already has deterministic safety evidence, but they
 * cannot pause an ordinary profile turn or grant an all-clear.
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
  // Model safety labels are advisory only. If the raw user message contains
  // no deterministic safety evidence, a model-only label cannot pause an
  // otherwise ordinary profile turn.
  const safetySignals = SafetySignalsListSchema.parse(
    deterministicSignals.length > 0
      ? [...new Set([...deterministicSignals, ...turn.safetySignals])]
      : [],
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
  screeningDraft: ConversationalSafetyScreeningDraft | null = null,
): AssistantSafetyResult {
  const signals = SafetySignalsListSchema.parse(safetySignals);
  if (signals.length > 0) {
    return { status: "unsupported", signals, generationAllowed: false };
  }
  if (
    screeningDraft &&
    deriveConversationalSafetyStatus(screeningDraft, signals) === "eligible"
  ) {
    return { status: "clear", signals: [], generationAllowed: true };
  }
  if (
    screeningDraft &&
    deriveConversationalSafetyStatus(screeningDraft, signals) === "blocked"
  ) {
    return { status: "needs_review", signals: [], generationAllowed: false };
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
