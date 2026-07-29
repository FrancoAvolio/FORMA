import { z } from "zod";

import { BoundedTextListSchema, LocaleSchema, UserMessageSchema } from "./common";
import type { AiRequestControls } from "./common";

export const SAFETY_SIGNAL_VALUES = [
  "pain_during_movement",
  "recent_injury",
  "recent_operation",
  "medical_restriction",
  "symptoms_during_exercise",
  "professional_instruction",
  "rehabilitation_request",
  "diagnosis_request",
  "pregnancy_specific",
  "minor",
  "complex_medical_condition",
  "medication_advice",
  "supplement_advice",
  "extreme_weight_loss",
  "eating_disorder_related",
] as const;

export const SafetySignalSchema = z.enum(SAFETY_SIGNAL_VALUES);

export const SafetySignalsListSchema = z
  .array(SafetySignalSchema)
  .max(24)
  .superRefine((signals, context) => {
    if (new Set(signals).size !== signals.length) {
      context.addIssue({
        code: "custom",
        message: "Las señales de seguridad no pueden repetirse.",
      });
    }
  });

export const SAFETY_CLASSIFICATION_VALUES = [
  "no_signal",
  "needs_review",
  "unsupported_signal",
] as const;

export const SafetyClassificationLevelSchema = z.enum(
  SAFETY_CLASSIFICATION_VALUES,
);

export const SafetyClassificationInputDataSchema = z
  .object({
    message: UserMessageSchema,
    declaredLimitations: BoundedTextListSchema.default([]),
    deterministicSignals: SafetySignalsListSchema.default([]),
    locale: LocaleSchema,
  })
  .strict();

export type SafetyClassificationInput = z.input<
  typeof SafetyClassificationInputDataSchema
> &
  AiRequestControls;

/**
 * Advisory model classification. The deterministic domain safety screen remains
 * authoritative and must combine this result with its own state/keyword checks.
 */
export const SafetyClassificationSchema = z
  .object({
    classification: SafetyClassificationLevelSchema,
    signals: SafetySignalsListSchema,
    reason: z.string().trim().min(1).max(500),
    clarificationQuestion: z.string().trim().min(1).max(300).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.classification === "needs_review" &&
      value.clarificationQuestion === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["clarificationQuestion"],
        message: "needs_review requiere una pregunta de aclaración.",
      });
    }

    if (
      value.classification !== "needs_review" &&
      value.clarificationQuestion !== null
    ) {
      context.addIssue({
        code: "custom",
        path: ["clarificationQuestion"],
        message: "Sólo needs_review puede incluir una pregunta.",
      });
    }

    if (value.classification === "no_signal" && value.signals.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["signals"],
        message: "no_signal no puede incluir señales.",
      });
    }

    if (value.classification !== "no_signal" && value.signals.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["signals"],
        message: "La clasificación requiere al menos una señal.",
      });
    }
  });

export type SafetyClassification = z.output<
  typeof SafetyClassificationSchema
>;

export function createSafetyClassificationSchema(
  deterministicSignals: readonly z.infer<typeof SafetySignalSchema>[],
) {
  const providerOutputSchema = z.preprocess((value) => {
    if (
      value !== null &&
      typeof value === "object" &&
      "classification" in value &&
      value.classification !== "needs_review" &&
      "clarificationQuestion" in value &&
      value.clarificationQuestion !== null
    ) {
      // Some structured models add an unnecessary follow-up to an otherwise
      // valid unsupported/no-signal result. It cannot affect the safety
      // decision, so canonicalize it before the strict domain validation.
      return { ...value, clarificationQuestion: null };
    }
    return value;
  }, SafetyClassificationSchema);

  return providerOutputSchema.superRefine((value, context) => {
    for (const signal of deterministicSignals) {
      if (!value.signals.includes(signal)) {
        context.addIssue({
          code: "custom",
          path: ["signals"],
          message: `La salida no puede eliminar la señal determinística: ${signal}.`,
        });
      }
    }
  });
}
