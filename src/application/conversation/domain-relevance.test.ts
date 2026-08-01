import { describe, expect, it } from "vitest";

import {
  isClearlyOffTopicMessage,
  OFF_TOPIC_REPLY,
} from "./domain-relevance";

describe("conversation domain relevance", () => {
  it("rejects an unrelated cooking request", () => {
    expect(isClearlyOffTopicMessage("Quiero hacer una pizza con jamón y queso")).toBe(
      true,
    );
    expect(isClearlyOffTopicMessage("Quiero hacer hamburguesas a la parrilla")).toBe(
      true,
    );
  });

  it("keeps training, safety, greetings, and short acknowledgements in the flow", () => {
    expect(isClearlyOffTopicMessage("Quiero una rutina de hipertrofia")).toBe(false);
    expect(isClearlyOffTopicMessage("Quiero hacer cardio")).toBe(false);
    expect(
      isClearlyOffTopicMessage(
        "No tengo dolor, lesiones recientes ni restricciones para entrenar",
      ),
    ).toBe(false);
    expect(isClearlyOffTopicMessage("No tengo nada de eso")).toBe(false);
    expect(isClearlyOffTopicMessage("Hola")).toBe(false);
    expect(isClearlyOffTopicMessage("No")).toBe(false);
    expect(isClearlyOffTopicMessage("Una hora y media")).toBe(false);
    expect(isClearlyOffTopicMessage("90 min")).toBe(false);
    expect(isClearlyOffTopicMessage("Quiero mejorar mi recistensia")).toBe(
      false,
    );
  });

  it("provides a stable redirect message", () => {
    expect(OFF_TOPIC_REPLY).toMatch(/rutinas|ejercicios|equipamiento/i);
  });

  it("does not let resistance wording override an explicit off-topic task", () => {
    expect(
      isClearlyOffTopicMessage("Quiero cocinar una pizza con resistencia"),
    ).toBe(true);
  });
});
