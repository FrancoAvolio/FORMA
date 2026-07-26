import { describe, expect, it } from "vitest";

import { toCompleteRoutineRequest } from "../schemas";
import {
  completeParseInput,
  explanationInput,
  modificationInput,
  safetyInput,
  type ProviderFactory,
} from "./fixtures";

export function describeAiProviderContract(
  name: string,
  createProvider: ProviderFactory,
): void {
  describe(`${name} AiProvider contract`, () => {
    it("returns a schema-valid request that converts to the domain contract", async () => {
      const result = await createProvider().parseRoutineRequest(completeParseInput);
      expect(result.status).toBe("complete");
      expect(toCompleteRoutineRequest(result)).not.toBeNull();
    });

    it("references only an exercise in the supplied plan context", async () => {
      const result = await createProvider().parseRoutineModification(
        modificationInput,
      );
      expect(result.modification).toMatchObject({
        kind: "replace_exercise",
        dayId: "day-1",
        exerciseId: "0047",
      });
    });

    it("returns an advisory safety classification", async () => {
      const result = await createProvider().classifySafety(safetyInput);
      expect(result).toMatchObject({
        classification: "no_signal",
        signals: [],
      });
    });

    it("returns a bounded explanation of validated data", async () => {
      const result = await createProvider().explainPlan(explanationInput);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(2_000);
    });
  });
}
