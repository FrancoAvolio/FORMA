import { describe, expect, it } from "vitest";

import { parseExplicitRoutineGoal } from "./parse-routine-goal";

describe("parseExplicitRoutineGoal", () => {
  it.each([
    "Resistencia",
    "resistencia muscular",
    "Recistencia",
    "Resistensia",
    "Recistensia",
    "Quiero mejorar mi resistencia",
  ])("recognizes muscular endurance from %s", (message) => {
    expect(parseExplicitRoutineGoal(message)).toBe("muscular_endurance");
  });

  it.each([
    ["Hipertrofia", "hypertrophy"],
    ["Quiero ganar fuerza", "strength"],
    ["Estado físico general", "general_fitness"],
  ] as const)("keeps %s mapped to %s", (message, goal) => {
    expect(parseExplicitRoutineGoal(message)).toBe(goal);
  });

  it.each([
    "Tengo bandas de resistencia",
    "Entreno con bandas de resistencia en casa",
    "Quiero fuerza y resistencia",
    "Hola",
  ])("does not guess an ambiguous or equipment-only goal from %s", (message) => {
    expect(parseExplicitRoutineGoal(message)).toBeNull();
  });
});
