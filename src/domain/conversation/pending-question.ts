import { z } from "zod";

import { ConversationalSafetyFieldSchema } from "../safety/conversational-screening";

const PendingSafetyFieldsSchema = z
  .array(ConversationalSafetyFieldSchema)
  .min(1)
  .max(6)
  .superRefine((fields, context) => {
    if (new Set(fields).size !== fields.length) {
      context.addIssue({
        code: "custom",
        message: "Una pregunta pendiente no puede repetir campos de seguridad.",
      });
    }
  });

export const PendingConversationQuestionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("safety_confirmation"),
      mode: z.enum(["confirm", "describe"]),
      assistantMessageId: z.string().trim().min(1).max(160),
      fields: PendingSafetyFieldsSchema,
    })
    .strict(),
]);

export type PendingConversationQuestion = z.output<
  typeof PendingConversationQuestionSchema
>;

export function createPendingSafetyQuestion(
  assistantMessageId: string,
  fields: PendingConversationQuestion["fields"],
  mode: PendingConversationQuestion["mode"] = "confirm",
): PendingConversationQuestion {
  return PendingConversationQuestionSchema.parse({
    kind: "safety_confirmation",
    mode,
    assistantMessageId,
    fields: [...fields],
  });
}
