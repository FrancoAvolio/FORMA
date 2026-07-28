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

/** Deterministic, fail-closed signals used before any model classification. */
export function detectSafetyReasonCodes(text: string): SafetyReasonCode[] {
  const normalized = normalizeDomainText(text);
  return TEXT_SAFETY_RULES.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(normalized)),
  ).map(({ code }) => code);
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
  const explicitAllClear = [
    /no tengo (ningun |ninguna )?(dolor|lesion|lesiones|limitacion|limitaciones|restriccion|restricciones)/,
    /sin (dolor|lesiones|limitaciones|restricciones)( ni (dolor|lesiones|limitaciones|restricciones))?/,
    /ninguna lesion ni restriccion/,
  ].some((pattern) => pattern.test(normalized));

  return explicitAllClear ? "no_limitations" : "unknown";
}
