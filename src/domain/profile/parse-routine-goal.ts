import { normalizeDomainText } from "../exercises/normalization";
import type { RoutineGoal } from "./routine-request";

const ENDURANCE_TERM = /\bre[sc]isten[cs]ia\b/u;
const ENDURANCE_WITH_CONTEXT =
  /\b(?:objetivo|quiero|busco|mejorar|ganar|aumentar|trabajar|entrenar para)\b/u;

/**
 * Parses only explicit routine-goal language. Curated misspellings are kept
 * narrow so equipment phrases such as "bandas de resistencia" stay equipment.
 */
export function parseExplicitRoutineGoal(message: string): RoutineGoal | null {
  const normalized = normalizeDomainText(message);
  const withoutResistanceBands = normalized
    .replace(/\bbandas? de re[sc]isten[cs]ia\b/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const matches = new Set<RoutineGoal>();

  if (
    /\b(?:hipertrofi\w*|ganar (?:masa|musculo)|masa muscular|crecer(?: musculo)?)\b/u.test(
      withoutResistanceBands,
    )
  ) {
    matches.add("hypertrophy");
  }
  if (/\b(?:fuerza|mas fuerte)\b/u.test(withoutResistanceBands)) {
    matches.add("strength");
  }
  if (
    /\bre[sc]isten[cs]ia muscular\b/u.test(withoutResistanceBands) ||
    (/^re[sc]isten[cs]ia$/u.test(withoutResistanceBands) ||
      (ENDURANCE_TERM.test(withoutResistanceBands) &&
        ENDURANCE_WITH_CONTEXT.test(withoutResistanceBands)))
  ) {
    matches.add("muscular_endurance");
  }
  if (
    /\b(?:estado fisico|fitness general|salud general|acondicionamiento general)\b/u.test(
      withoutResistanceBands,
    )
  ) {
    matches.add("general_fitness");
  }

  return matches.size === 1 ? [...matches][0]! : null;
}
