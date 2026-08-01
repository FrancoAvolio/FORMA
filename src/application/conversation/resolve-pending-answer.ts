import type { PendingConversationQuestion } from "../../domain/conversation/pending-question";
import { normalizeDomainText } from "../../domain/exercises/normalization";
import type {
  ConversationalSafetyField,
  ConversationalSafetyPatch,
} from "../../domain/safety/conversational-screening";

export type PendingConversationAnswerResolution =
  | {
      kind: "negative";
      fields: ConversationalSafetyField[];
      patch: ConversationalSafetyPatch;
    }
  | {
      kind: "affirmative";
      fields: ConversationalSafetyField[];
    }
  | { kind: "unresolved" };

const SHORT_NEGATIVE_REPLY =
  /^(?:no+|nop|nope|ningun|ninguna|ninguno|nada|para nada|no nada|no ninguna|no ninguno|no tengo nada|no tengo ninguna|no tengo ninguno|no tengo nada de eso|ninguna de esas|ninguno de esos|ninguna de esas cosas|todo negativo)$/u;
const BROAD_NEGATIVE_REPLY = [
  /^no\b.*\b(?:ni )?nada de eso$/u,
  /^no tengo nada que (?:afecte|limite|impida) (?:mi )?entrenamiento$/u,
  /^no tengo ningun problema (?:para|al) entrenar$/u,
  /^no tengo ninguna (?:restriccion|limitacion)(?: medica)?(?: para entrenar)?$/u,
  /^no tengo ninguna lesion ni (?:restriccion|limitacion)(?: para entrenar)?$/u,
] as const;
const SHORT_AFFIRMATIVE_REPLY =
  /^(?:si|si tengo algo|si hay algo|tengo algo|si quiero aclarar|si quiero aclararlo|si necesito aclarar|si necesito aclararlo)$/u;
const AMBIGUOUS_OR_CONTRADICTORY_REPLY =
  /\b(?:pero|aunque|salvo|excepto|no se|creo|supongo|quizas|tal vez)\b/u;

/**
 * Resolves only short answers to an application-authored pending question.
 * Explicit safety statements continue through the normal deterministic text
 * detectors, and a message without pending context can never grant clearance.
 */
export function resolvePendingConversationAnswer(
  message: string,
  pendingQuestion: PendingConversationQuestion | null,
): PendingConversationAnswerResolution {
  if (!pendingQuestion) return { kind: "unresolved" };

  const normalized = normalizeDomainText(message);
  if (
    normalized.length === 0 ||
    AMBIGUOUS_OR_CONTRADICTORY_REPLY.test(normalized)
  ) {
    return { kind: "unresolved" };
  }

  const fields = [...pendingQuestion.fields];
  if (
    SHORT_NEGATIVE_REPLY.test(normalized) ||
    BROAD_NEGATIVE_REPLY.some((pattern) => pattern.test(normalized))
  ) {
    return {
      kind: "negative",
      fields,
      patch: Object.fromEntries(
        fields.map((field) => [field, false]),
      ) as ConversationalSafetyPatch,
    };
  }

  if (SHORT_AFFIRMATIVE_REPLY.test(normalized)) {
    return { kind: "affirmative", fields };
  }

  return { kind: "unresolved" };
}
