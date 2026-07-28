import { describe, expect, it } from "vitest";

import { CLASSIFY_SAFETY_PROMPT } from "../prompts/classify-safety";
import { COMPOSE_ASSISTANT_RESPONSE_PROMPT } from "../prompts/compose-assistant-response";
import { EXPLAIN_ROUTINE_PROMPT } from "../prompts/explain-routine";
import { PARSE_ROUTINE_MODIFICATION_PROMPT } from "../prompts/parse-routine-modification";
import { PARSE_ROUTINE_TURN_PROMPT } from "../prompts/parse-routine-request";
import { REPAIR_STRUCTURED_OUTPUT_PROMPT } from "../prompts/repair-structured-output";

const spanishContractPrompts = [
  COMPOSE_ASSISTANT_RESPONSE_PROMPT,
  PARSE_ROUTINE_MODIFICATION_PROMPT,
  CLASSIFY_SAFETY_PROMPT,
  EXPLAIN_ROUTINE_PROMPT,
  REPAIR_STRUCTURED_OUTPUT_PROMPT,
];

describe("versioned prompt contracts", () => {
  it("keeps the latest-turn extractor compact and explicit", () => {
    const prompt = PARSE_ROUTINE_TURN_PROMPT;

    expect(prompt.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(prompt.purpose.length).toBeGreaterThan(20);
    expect(prompt.examples.length).toBeGreaterThanOrEqual(3);
    expect(prompt.system).toContain("Read ONLY the text inside <latest-message>");
    expect(prompt.system).toContain("OUTPUT");
    expect(prompt.system).toContain("FORBIDDEN");
    expect(prompt.system).toContain("Never guess");
  });

  it.each(spanishContractPrompts)("$id includes required prompt metadata", (prompt) => {
    expect(prompt.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(prompt.purpose.length).toBeGreaterThan(20);
    expect(prompt.examples.length).toBeGreaterThanOrEqual(3);
    expect(prompt.system).toContain("CONTRATO DE ENTRADA");
    expect(prompt.system).toContain("CONTRATO DE SALIDA");
    expect(prompt.system).toContain("COMPORTAMIENTO PROHIBIDO");
    expect(prompt.system).toContain("EJEMPLOS");
  });
});
