import { z } from "zod";

import { countUserMessageWords } from "@/domain/conversation/user-message";

import { AI_LIMITS } from "../limits";

export const BoundedTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(AI_LIMITS.listItemCharacters);

export const BoundedTextListSchema = z
  .array(BoundedTextSchema)
  .max(AI_LIMITS.listItems)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: "custom",
        message: "Los valores de la lista no pueden repetirse.",
      });
    }
  });

export const UserMessageSchema = z
  .string()
  .trim()
  .min(1)
  .max(AI_LIMITS.messageCharacters)
  .refine((value) => countUserMessageWords(value) <= AI_LIMITS.messageWords, {
    message: `El mensaje no puede superar ${AI_LIMITS.messageWords} palabras.`,
  });

export const LocaleSchema = z.literal("es-AR").default("es-AR");

export type AiRequestControls = {
  signal?: AbortSignal;
};
