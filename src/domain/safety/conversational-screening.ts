import { z } from "zod";

import { normalizeDomainText } from "../exercises/normalization";
import { SafetySignalSchema } from "../../ai/schemas/safety";
import {
  SafetyScreeningSchema,
  type SafetyScreening,
} from "./schemas";

export const CONVERSATIONAL_SAFETY_FIELD_VALUES = [
  "painDuringMovement",
  "recentInjury",
  "recentOperation",
  "medicalRestriction",
  "symptomsDuringExercise",
  "professionalInstructionsAffectTraining",
] as const;

export const ConversationalSafetyFieldSchema = z.enum(
  CONVERSATIONAL_SAFETY_FIELD_VALUES,
);

export type ConversationalSafetyField = z.output<
  typeof ConversationalSafetyFieldSchema
>;

export const ConversationalSafetyScreeningDraftSchema = z
  .object({
    painDuringMovement: z.boolean().nullable(),
    recentInjury: z.boolean().nullable(),
    recentOperation: z.boolean().nullable(),
    medicalRestriction: z.boolean().nullable(),
    symptomsDuringExercise: z.boolean().nullable(),
    professionalInstructionsAffectTraining: z.boolean().nullable(),
  })
  .strict();

export type ConversationalSafetyScreeningDraft = z.output<
  typeof ConversationalSafetyScreeningDraftSchema
>;

export type SafetyAnswer = boolean | null;

type SafetySignal = z.output<typeof SafetySignalSchema>;

export type ConversationalSafetyPatch = Partial<
  Record<ConversationalSafetyField, boolean>
>;

export const CONVERSATIONAL_SAFETY_FIELD_LABELS: Readonly<
  Record<ConversationalSafetyField, string>
> = {
  painDuringMovement: "dolor al moverte",
  recentInjury: "lesiones recientes",
  recentOperation: "operaciones recientes",
  medicalRestriction: "restricciones médicas",
  symptomsDuringExercise: "síntomas durante el ejercicio",
  professionalInstructionsAffectTraining:
    "indicaciones profesionales que afecten tu entrenamiento",
};

const FIELD_PATTERNS: Readonly<
  Record<ConversationalSafetyField, RegExp>
> = {
  painDuringMovement: /\b(?:dolor|duele|molestia|molesta)\b/u,
  recentInjury: /\b(?:lesion|lesiones|lesione)\w*\b/u,
  recentOperation: /\b(?:operacion|operaciones|cirugia|cirugias|opere)\w*\b/u,
  medicalRestriction:
    /\b(?:restriccion|restricciones|limitacion|limitaciones)\w*(?:\s+(?:medica|medicas|profesional|profesionales))?\b/u,
  symptomsDuringExercise:
    /\b(?:sintoma|sintomas|mareo|mareos|desmayo|desmayos|falta de aire|dolor de pecho)\w*\b/u,
  professionalInstructionsAffectTraining:
    /\b(?:indicacion|indicaciones|instruccion|instrucciones|recomendacion|recomendaciones)\w*(?:\s+(?:medica|medicas|del medico|profesional|profesionales))?\b/u,
};

const NEGATION_PATTERN =
  /\b(?:no|sin|ningun|ninguna|nunca|ni)\b/u;
const CONTRADICTION_PATTERN = /\b(?:pero|aunque|sin embargo)\b/u;

export function createEmptyConversationalSafetyScreeningDraft(): ConversationalSafetyScreeningDraft {
  return {
    painDuringMovement: null,
    recentInjury: null,
    recentOperation: null,
    medicalRestriction: null,
    symptomsDuringExercise: null,
    professionalInstructionsAffectTraining: null,
  };
}

export function createClearConversationalSafetyScreeningDraft(): ConversationalSafetyScreeningDraft {
  return {
    painDuringMovement: false,
    recentInjury: false,
    recentOperation: false,
    medicalRestriction: false,
    symptomsDuringExercise: false,
    professionalInstructionsAffectTraining: false,
  };
}

function normalizedSafetyText(message: string): string {
  return normalizeDomainText(message)
    .replace(/[!?]/gu, ".")
    .replace(/\s+/gu, " ")
    .trim();
}

function fieldMentioned(field: ConversationalSafetyField, text: string): boolean {
  return FIELD_PATTERNS[field].test(text);
}

function fieldsMentioned(text: string): ConversationalSafetyField[] {
  return CONVERSATIONAL_SAFETY_FIELD_VALUES.filter((field) =>
    fieldMentioned(field, text),
  );
}

function setClauseAnswers(
  patch: ConversationalSafetyPatch,
  clause: string,
): void {
  const mentioned = fieldsMentioned(clause);
  if (mentioned.length === 0) return;
  const negative = NEGATION_PATTERN.test(clause);
  for (const field of mentioned) patch[field] = !negative;
}

/**
 * Extracts only field answers that are explicitly present in the latest turn.
 * A broad denial maps to the restriction field only; it never synthesizes the
 * other five answers.
 */
export function extractConversationalSafetyPatch(
  message: string,
): ConversationalSafetyPatch {
  const text = normalizedSafetyText(message);
  if (text.length === 0) return {};

  const patch: ConversationalSafetyPatch = {};
  const hasNegation = /\b(?:no tengo|no tuve|no presento|sin)\b/u.test(text);
  const hasContradiction = CONTRADICTION_PATTERN.test(text);

  if (hasNegation && !hasContradiction) {
    for (const field of fieldsMentioned(text)) patch[field] = false;
    return patch;
  }

  const clauses = text
    .split(/[,;.]+|\b(?:pero|aunque|sin embargo)\b/gu)
    .map((clause) => clause.trim())
    .filter(Boolean);
  for (const clause of clauses) setClauseAnswers(patch, clause);
  return patch;
}

export function mergeConversationalSafetyPatch(
  current: ConversationalSafetyScreeningDraft,
  patch: ConversationalSafetyPatch,
): ConversationalSafetyScreeningDraft {
  const parsed = ConversationalSafetyScreeningDraftSchema.parse(current);
  const safePatch = ConversationalSafetyScreeningDraftSchema.partial().parse(
    patch,
  );
  return ConversationalSafetyScreeningDraftSchema.parse({
    ...parsed,
    ...safePatch,
  });
}

export function deriveMissingSafetyFields(
  draft: ConversationalSafetyScreeningDraft,
): ConversationalSafetyField[] {
  const parsed = ConversationalSafetyScreeningDraftSchema.parse(draft);
  return CONVERSATIONAL_SAFETY_FIELD_VALUES.filter(
    (field) => parsed[field] === null,
  );
}

export type ConversationalSafetyStatus = "pending" | "eligible" | "blocked";

export function deriveConversationalSafetyStatus(
  draft: ConversationalSafetyScreeningDraft,
  safetySignals: readonly SafetySignal[] = [],
): ConversationalSafetyStatus {
  const parsed = ConversationalSafetyScreeningDraftSchema.parse(draft);
  if (
    safetySignals.length > 0 ||
    CONVERSATIONAL_SAFETY_FIELD_VALUES.some((field) => parsed[field] === true)
  ) {
    return "blocked";
  }
  return deriveMissingSafetyFields(parsed).length === 0
    ? "eligible"
    : "pending";
}

export function toCompleteSafetyScreening(
  draft: ConversationalSafetyScreeningDraft,
  safetySignals: readonly SafetySignal[] = [],
): SafetyScreening | null {
  if (deriveConversationalSafetyStatus(draft, safetySignals) !== "eligible") {
    return null;
  }
  const parsed = ConversationalSafetyScreeningDraftSchema.parse(draft);
  return SafetyScreeningSchema.parse({
    confirmedCurrentStatus: true,
    painDuringMovement: parsed.painDuringMovement,
    recentInjury: parsed.recentInjury,
    recentOperation: parsed.recentOperation,
    medicalRestriction: parsed.medicalRestriction,
    symptomsDuringExercise: parsed.symptomsDuringExercise,
    professionalInstructionsAffectTraining:
      parsed.professionalInstructionsAffectTraining,
  });
}

export function safetyScreeningToConversationalDraft(
  screening: SafetyScreening,
): ConversationalSafetyScreeningDraft {
  const parsed = SafetyScreeningSchema.parse(screening);
  return ConversationalSafetyScreeningDraftSchema.parse({
    painDuringMovement: parsed.painDuringMovement,
    recentInjury: parsed.recentInjury,
    recentOperation: parsed.recentOperation,
    medicalRestriction: parsed.medicalRestriction,
    symptomsDuringExercise: parsed.symptomsDuringExercise,
    professionalInstructionsAffectTraining:
      parsed.professionalInstructionsAffectTraining,
  });
}
