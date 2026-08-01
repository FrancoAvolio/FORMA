import { describe, expect, it } from "vitest";

import { createPendingSafetyQuestion } from "../../domain/conversation/pending-question";
import {
  CONVERSATIONAL_SAFETY_FIELD_VALUES,
  type ConversationalSafetyField,
} from "../../domain/safety/conversational-screening";
import { resolvePendingConversationAnswer } from "./resolve-pending-answer";

const pending = createPendingSafetyQuestion(
  "assistant-safety-question",
  [...CONVERSATIONAL_SAFETY_FIELD_VALUES],
);

describe("resolvePendingConversationAnswer", () => {
  it.each([
    "No",
    "NO.",
    "Nop",
    "No, ninguna",
    "Nada",
    "No tengo nada",
    "No tengo nada de eso",
    "No tengo ninguna restricción para entrenar",
    "No tengo nada que afecte mi entrenamiento",
    "No tengo dolor al moverme ni lesiones recientes ni nada de eso",
  ])("resolves contextual all-clear wording from %s", (message) => {
    const result = resolvePendingConversationAnswer(message, pending);

    expect(result).toMatchObject({ kind: "negative" });
    if (result.kind !== "negative") throw new Error("Expected a negative reply");
    expect(result.patch).toEqual(
      Object.fromEntries(
        CONVERSATIONAL_SAFETY_FIELD_VALUES.map((field) => [field, false]),
      ),
    );
  });

  it("clears only the fields in the pending question", () => {
    const fields: ConversationalSafetyField[] = [
      "recentOperation",
      "symptomsDuringExercise",
    ];
    const result = resolvePendingConversationAnswer(
      "No",
      createPendingSafetyQuestion("assistant-partial", fields),
    );

    expect(result).toEqual({
      kind: "negative",
      fields,
      patch: {
        recentOperation: false,
        symptomsDuringExercise: false,
      },
    });
  });

  it.each(["Sí", "Sí, tengo algo", "Sí, quiero aclarar"])(
    "requests detail without inventing a category for %s",
    (message) => {
      expect(resolvePendingConversationAnswer(message, pending)).toEqual({
        kind: "affirmative",
        fields: [...CONVERSATIONAL_SAFETY_FIELD_VALUES],
      });
    },
  );

  it.each([
    "No",
    "No tengo nada de eso",
  ])("does not grant clearance without pending context for %s", (message) => {
    expect(resolvePendingConversationAnswer(message, null)).toEqual({
      kind: "unresolved",
    });
  });

  it.each([
    "No, pero me duele la rodilla",
    "Ninguna salvo una operación reciente",
    "Creo que no",
    "No sé",
  ])("leaves ambiguous or contradictory wording unresolved for %s", (message) => {
    expect(resolvePendingConversationAnswer(message, pending)).toEqual({
      kind: "unresolved",
    });
  });
});
