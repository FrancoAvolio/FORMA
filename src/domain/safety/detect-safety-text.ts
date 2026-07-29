import { normalizeDomainText } from "../exercises/normalization";
import type { SafetyReasonCode } from "./schemas";

const TEXT_SAFETY_RULES: ReadonlyArray<{
  code: SafetyReasonCode;
  patterns: readonly RegExp[];
}> = [
  {
    code: "PAIN_DURING_MOVEMENT",
    patterns: [
      /me duele/,
      /siento dolor (al|cuando|durante)/,
      /dolor (al|cuando|durante) (hacer|entrenar|mover)/,
    ],
  },
  {
    code: "SYMPTOMS_DURING_EXERCISE",
    patterns: [
      /(mareo|desmayo|falta de aire|dolor de pecho) (al|cuando|durante) (entrenar|hacer ejercicio)/,
      /sintomas? durante (el )?ejercicio/,
    ],
  },
  {
    code: "MEDICAL_RESTRICTION",
    patterns: [/restriccion medica (actual|vigente)/, /tengo una restriccion medica/],
  },
  {
    code: "ACUTE_INJURY_REQUEST",
    patterns: [
      /me lesione (hoy|ayer|hace poco)/,
      /lesion (aguda|reciente)/,
      /acute injury/,
    ],
  },
  {
    code: "REHABILITATION_REQUEST",
    patterns: [/rehabilit/, /rehab/, /recuperar(me)? de (una )?lesion/],
  },
  {
    code: "POSTOPERATIVE_REQUEST",
    patterns: [/post ?operator/, /despues de (una )?cirugia/, /recent surgery/],
  },
  {
    code: "DIAGNOSIS_REQUEST",
    patterns: [/diagnostic/, /diagnose/, /que lesion tengo/, /que enfermedad tengo/],
  },
  {
    code: "PREGNANCY_SPECIFIC_REQUEST",
    patterns: [/embaraz/, /pregnan/, /prenatal/, /postparto/, /postpartum/],
  },
  {
    code: "MINOR_REQUEST",
    patterns: [
      /soy menor/,
      /para (un|una) menor/,
      /tengo (?:[0-9]|1[0-7]) anos/,
      /under ?18/,
    ],
  },
  {
    code: "COMPLEX_MEDICAL_REQUEST",
    patterns: [
      /cardiopati/,
      /insuficiencia (cardiaca|renal|respiratoria)/,
      /cancer/,
      /epileps/,
      /medical condition/,
    ],
  },
  {
    code: "MEDICATION_REQUEST",
    patterns: [/medicacion/, /medicamento/, /farmaco/, /dosage/, /dosis/],
  },
  {
    code: "SUPPLEMENT_REQUEST",
    patterns: [/suplement/, /creatina/, /proteina en polvo/, /pre ?entreno/],
  },
  {
    code: "EXTREME_WEIGHT_LOSS_REQUEST",
    patterns: [
      /bajar [0-9]+ ?kg en (una|1) semana/,
      /perder peso (muy )?rapido/,
      /rapid weight loss/,
      /extreme weight loss/,
    ],
  },
  {
    code: "EATING_DISORDER_REQUEST",
    patterns: [/anorexi/, /bulimi/, /trastorno aliment/, /eating disorder/],
  },
];

export const UNSUPPORTED_TEXT_REASON_CODES = new Set<SafetyReasonCode>([
  "ACUTE_INJURY_REQUEST",
  "REHABILITATION_REQUEST",
  "POSTOPERATIVE_REQUEST",
  "DIAGNOSIS_REQUEST",
  "PREGNANCY_SPECIFIC_REQUEST",
  "MINOR_REQUEST",
  "COMPLEX_MEDICAL_REQUEST",
  "MEDICATION_REQUEST",
  "SUPPLEMENT_REQUEST",
  "EXTREME_WEIGHT_LOSS_REQUEST",
  "EATING_DISORDER_REQUEST",
]);

function hasAffirmativeSafetyContradiction(text: string): boolean {
  return (
    /(?<!\bno )\b(?:me duele|me lesione|siento (?:dolor|sintomas?)|tuve (?:una? )?(?:lesion|operacion|cirugia))\b/u.test(
      text,
    ) ||
    /(?<!\bno )\btengo (?:un )?(?:dolor|sintomas?)\b/u.test(text) ||
    /(?<!\bno )\btengo (?:una?|alguna?) (?:lesion|operacion|cirugia|restriccion|limitacion|indicacion profesional)\b/u.test(
      text,
    ) ||
    /\b(?:pero|aunque) (?:si )?(?:tengo |tuve |siento )?(?:un |una )?(?:dolor|lesion|operacion|cirugia|restriccion|limitacion|sintoma|indicacion profesional)\b/u.test(
      text,
    )
  );
}

function isNegatedMatch(text: string, index: number): boolean {
  const immediatePrefix = text.slice(Math.max(0, index - 12), index);
  if (/\bno\s*$/u.test(immediatePrefix)) {
    return true;
  }
  const boundary = Math.max(
    text.lastIndexOf(",", index),
    text.lastIndexOf(";", index),
    text.lastIndexOf(".", index),
  );
  const clause = text.slice(boundary + 1, index);
  if (
    /\b(?:pero|aunque)\b/u.test(clause) ||
    hasAffirmativeSafetyContradiction(clause)
  ) {
    return false;
  }
  return /\b(?:no tengo|no siento|no me|sin|ni|ningun|ninguna)\b/u.test(
    clause,
  );
}

function isExplicitNegatedSafetyList(text: string): boolean {
  return (
    /\b(?:no tengo|sin)\b/u.test(text) &&
    /\bni\b/u.test(text) &&
    /\b(?:dolor|lesion|restriccion|sintoma|operacion|indicacion)\b/u.test(text) &&
    !hasAffirmativeSafetyContradiction(text)
  );
}

function normalizeSafetyText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9,;.!?\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Deterministic, fail-closed signals used before any model classification. */
export function detectSafetyReasonCodes(text: string): SafetyReasonCode[] {
  const normalized = normalizeSafetyText(text);
  const detected = TEXT_SAFETY_RULES.filter(({ patterns }) =>
    patterns.some((pattern) => {
      const match = pattern.exec(normalized);
      return Boolean(match && !isNegatedMatch(normalized, match.index));
    }),
  ).map(({ code }) => code);
  if (!isExplicitNegatedSafetyList(normalized)) {
    return detected;
  }

  // A broad all-clear may suppress false matches inside its comma-separated
  // safety list, but it can never suppress an independently unsupported
  // request (for example pregnancy-specific programming or a minor).
  return detected.filter((code) => UNSUPPORTED_TEXT_REASON_CODES.has(code));
}

export type DeterministicLimitationsDeclaration =
  | "unknown"
  | "no_limitations"
  | "has_limitations";

/**
 * Safety confirmation cannot be granted by model output alone. This deliberately
 * recognizes only explicit first-person declarations and fails closed otherwise.
 */
export function detectLimitationsDeclaration(
  text: string,
): DeterministicLimitationsDeclaration {
  if (detectSafetyReasonCodes(text).length > 0) {
    return "has_limitations";
  }

  const normalized = normalizeDomainText(text);
  const hasExplicitDenial = /\b(no tengo|no siento|sin|ningun|ninguna)\b/u.test(
    normalized,
  );
  const hasContradiction = hasAffirmativeSafetyContradiction(normalized);
  const deniesPainOrInjury = /\b(?:dolor|lesion|lesiones)\b/u.test(normalized);
  const deniesBroadRestrictions =
    /\b(?:limitacion|limitaciones|restriccion|restricciones)\b/u.test(
      normalized,
    );
  const explicitAllClear =
    hasExplicitDenial &&
    !hasContradiction &&
    deniesPainOrInjury &&
    deniesBroadRestrictions;

  return explicitAllClear ? "no_limitations" : "unknown";
}
