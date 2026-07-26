import { z } from "zod";

/** Answers to the explicit pre-generation safety questions required by GOAL.md. */
export const SafetyScreeningSchema = z.object({
  confirmedCurrentStatus: z.boolean(),
  painDuringMovement: z.boolean(),
  recentInjury: z.boolean(),
  recentOperation: z.boolean(),
  medicalRestriction: z.boolean(),
  symptomsDuringExercise: z.boolean(),
  professionalInstructionsAffectTraining: z.boolean(),
});

export const SafetyClassificationSchema = z.enum([
  "eligible",
  "confirmation_required",
  "professional_guidance_required",
  "unsupported_request",
]);

export const SafetyReasonCodeSchema = z.enum([
  "STATUS_NOT_CONFIRMED",
  "PAIN_DURING_MOVEMENT",
  "RECENT_INJURY",
  "RECENT_OPERATION",
  "MEDICAL_RESTRICTION",
  "SYMPTOMS_DURING_EXERCISE",
  "PROFESSIONAL_INSTRUCTIONS",
  "ACUTE_INJURY_REQUEST",
  "REHABILITATION_REQUEST",
  "POSTOPERATIVE_REQUEST",
  "DIAGNOSIS_REQUEST",
  "PREGNANCY_SPECIFIC_REQUEST",
  "MINOR_REQUEST",
  "COMPLEX_MEDICAL_REQUEST",
  "MEDICATION_REQUEST",
  "SUPPLEMENT_REQUEST",
  "EXTREME_WEIGHT_LOSS_REQUEST",
  "EATING_DISORDER_REQUEST",
]);

export type SafetyScreening = z.infer<typeof SafetyScreeningSchema>;
export type SafetyClassification = z.infer<typeof SafetyClassificationSchema>;
export type SafetyReasonCode = z.infer<typeof SafetyReasonCodeSchema>;

export type SafetyAssessment = {
  allowed: boolean;
  classification: SafetyClassification;
  reasonCodes: SafetyReasonCode[];
  message: string;
};

