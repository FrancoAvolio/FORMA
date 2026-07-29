import { describe, expect, it } from "vitest";

import { parseSessionDuration } from "./parse-session-duration";

describe("parseSessionDuration", () => {
  it.each([
    ["90 min", 90],
    ["90 minutos por sesión", 90],
    ["noventa minutos", 90],
    ["1 h 30", 90],
    ["1h30 por día", 90],
    ["una hora y media", 90],
    ["1 hora y media por sesión", 90],
    ["una hora y treinta minutos", 90],
    ["1,5 horas", 90],
    ["media hora", 30],
    ["dos horas", 120],
  ])("parses %s as %i minutes", (message, expected) => {
    expect(parseSessionDuration(message)).toBe(expected);
  });

  it.each(["15 minutos", "180 minutos", "tres horas", "cuatro días"])(
    "rejects unsupported or unrelated value %s",
    (message) => {
      expect(parseSessionDuration(message)).toBeNull();
    },
  );
});
