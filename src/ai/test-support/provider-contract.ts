import { describe, expect, it } from "vitest";

import { createEmptyRoutineRequestDraft } from "../../domain/profile/routine-draft";
import {
  applyParsedRoutineTurn,
  toCompleteRoutineRequest,
} from "../../application/conversation/routine-turn-state";
import {
  completeParseInput,
  assistantResponseInput,
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
      const turn = await createProvider().parseRoutineTurn(completeParseInput);
      const result = applyParsedRoutineTurn(
        createEmptyRoutineRequestDraft(),
        "not_confirmed",
        turn,
      );
      expect(result.status).toBe("complete");
      expect(
        toCompleteRoutineRequest(
          result.requestDraft,
          result.limitationsConfirmation,
        ),
      ).not.toBeNull();
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

    it("verbalizes only validated application context", async () => {
      const result = await createProvider().composeAssistantResponse(
        assistantResponseInput,
      );
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.message.length).toBeLessThanOrEqual(2_000);
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
