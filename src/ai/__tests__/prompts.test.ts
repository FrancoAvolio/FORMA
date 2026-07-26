import { describe, expect, it } from "vitest";

import { CLASSIFY_SAFETY_PROMPT } from "../prompts/classify-safety";
import { EXPLAIN_ROUTINE_PROMPT } from "../prompts/explain-routine";
import { PARSE_ROUTINE_MODIFICATION_PROMPT } from "../prompts/parse-routine-modification";
import { PARSE_ROUTINE_REQUEST_PROMPT } from "../prompts/parse-routine-request";
import { REPAIR_STRUCTURED_OUTPUT_PROMPT } from "../prompts/repair-structured-output";

const prompts = [
  PARSE_ROUTINE_REQUEST_PROMPT,
  PARSE_ROUTINE_MODIFICATION_PROMPT,
  CLASSIFY_SAFETY_PROMPT,
  EXPLAIN_ROUTINE_PROMPT,
  REPAIR_STRUCTURED_OUTPUT_PROMPT,
];

describe("versioned prompt contracts", () => {
  it.each(prompts)("$id includes required prompt metadata", (prompt) => {
    expect(prompt.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(prompt.purpose.length).toBeGreaterThan(20);
    expect(prompt.examples).toHaveLength(3);
    expect(prompt.system).toContain("CONTRATO DE ENTRADA");
    expect(prompt.system).toContain("CONTRATO DE SALIDA");
    expect(prompt.system).toContain("COMPORTAMIENTO PROHIBIDO");
    expect(prompt.system).toContain("EJEMPLOS");
  });
});

