import { z } from "zod";

import {
  LimitationsConfirmationSchema,
  RequiredRoutineFieldSchema,
  RoutineRequestDraftSchema,
} from "../../domain/profile/routine-draft";
import { AI_LIMITS } from "../limits";
import { BoundedTextListSchema, BoundedTextSchema, LocaleSchema } from "./common";
import type { AiRequestControls } from "./common";
import { ValidatedPlanSummarySchema } from "./explanation";
import { RoutineTurnIntentSchema } from "./routine-request";
import { SafetySignalsListSchema } from "./safety";

export const ASSISTANT_NEXT_ACTION_VALUES = [
  "ask_missing_information",
  "generate_routine",
  "open_guided_form",
  "review_safety",
  "show_routine",
  "modify_routine",
  "answer_question",
  "browse_exercises",
  "retry_ai",
  "save_routine",
] as const;

export const AssistantNextActionSchema = z.enum(
  ASSISTANT_NEXT_ACTION_VALUES,
);

export const AssistantSafetyResultSchema = z
  .object({
    status: z.enum(["clear", "needs_review", "unsupported"]),
    signals: SafetySignalsListSchema,
    generationAllowed: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.generationAllowed !== (value.status === "clear")) {
      context.addIssue({
        code: "custom",
        path: ["generationAllowed"],
        message: "Una revisión de seguridad no permite generar una rutina.",
      });
    }
    if (value.status === "unsupported" && value.signals.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["signals"],
        message: "El estado unsupported requiere una señal validada.",
      });
    }
  });

const GroundedAlternativeSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(160),
  })
  .strict();

export const GroundedExerciseResponseContextSchema = z
  .object({
    exerciseId: z.string().trim().min(1).max(64),
    displayName: z.string().trim().min(1).max(160),
    primaryTarget: z.string().trim().min(1).max(120),
    secondaryMuscles: BoundedTextListSchema,
    equipment: BoundedTextListSchema,
    instructions: z.array(BoundedTextSchema).max(12),
    selectionReasons: BoundedTextListSchema,
    approvedAlternatives: z.array(GroundedAlternativeSchema).max(8),
  })
  .strict();

export const ComposeAssistantResponseInputDataSchema = z
  .object({
    latestIntent: RoutineTurnIntentSchema,
    canonicalDraft: RoutineRequestDraftSchema,
    limitationsConfirmation: LimitationsConfirmationSchema,
    missingFields: z.array(RequiredRoutineFieldSchema).max(6),
    completionPercentage: z.number().int().min(0).max(100),
    parseStatus: z.enum(["complete", "needs_input", "unsupported"]),
    safetyResult: AssistantSafetyResultSchema,
    focusedQuestionFields: z.array(RequiredRoutineFieldSchema).max(2),
    validatedPlan: ValidatedPlanSummarySchema.nullable().default(null),
    exerciseContext: GroundedExerciseResponseContextSchema.nullable().default(
      null,
    ),
    allowedNextActions: z
      .array(AssistantNextActionSchema)
      .min(1)
      .max(10)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
          context.addIssue({
            code: "custom",
            message: "Las próximas acciones no pueden repetirse.",
          });
        }
      }),
    assumptions: z.array(BoundedTextSchema).max(12),
    locale: LocaleSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const uniqueMissing = new Set(value.missingFields);
    if (uniqueMissing.size !== value.missingFields.length) {
      context.addIssue({
        code: "custom",
        path: ["missingFields"],
        message: "Los campos faltantes no pueden repetirse.",
      });
    }
    for (const field of value.focusedQuestionFields) {
      if (!uniqueMissing.has(field)) {
        context.addIssue({
          code: "custom",
          path: ["focusedQuestionFields"],
          message: "Sólo se puede preguntar por un campo faltante.",
        });
      }
    }

    const expectedCompletion = Math.round(
      ((6 - value.missingFields.length) / 6) * 100,
    );
    if (value.completionPercentage !== expectedCompletion) {
      context.addIssue({
        code: "custom",
        path: ["completionPercentage"],
        message: "El porcentaje no coincide con los campos faltantes.",
      });
    }

    if (
      value.parseStatus === "complete" &&
      (value.missingFields.length > 0 || !value.safetyResult.generationAllowed)
    ) {
      context.addIssue({
        code: "custom",
        path: ["parseStatus"],
        message: "complete requiere perfil completo y generación habilitada.",
      });
    }
    if (
      value.parseStatus === "needs_input" &&
      value.missingFields.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["parseStatus"],
        message: "needs_input requiere campos faltantes.",
      });
    }
    if (
      value.parseStatus === "unsupported" &&
      value.safetyResult.status === "clear"
    ) {
      context.addIssue({
        code: "custom",
        path: ["parseStatus"],
        message: "unsupported requiere un resultado de seguridad no habilitado.",
      });
    }
    if (
      value.safetyResult.status === "clear" &&
      value.limitationsConfirmation === "not_confirmed"
    ) {
      context.addIssue({
        code: "custom",
        path: ["limitationsConfirmation"],
        message:
          "La seguridad clara requiere una revisión explícita del estado actual.",
      });
    }
  });

export type ComposeAssistantResponseInput = z.input<
  typeof ComposeAssistantResponseInputDataSchema
> &
  AiRequestControls;

export type ValidatedAssistantResponseContext = z.output<
  typeof ComposeAssistantResponseInputDataSchema
>;

export const AssistantResponseSchema = z
  .object({
    message: z
      .string()
      .trim()
      .min(1)
      .max(AI_LIMITS.explanationCharacters),
  })
  .strict();

export type AssistantResponse = z.output<typeof AssistantResponseSchema>;
