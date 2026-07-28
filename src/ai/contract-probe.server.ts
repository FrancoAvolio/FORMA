import "server-only";

import type { AiProvider } from "./ai-provider";
import { isAiProviderError } from "./errors";
import { createEmptyRoutineRequestDraft } from "../domain/profile/routine-draft";
import {
  applyParsedRoutineTurn,
  toCompleteRoutineRequest,
} from "../application/conversation/routine-turn-state";
import { reconcileParsedTurnSafety } from "../application/conversation/deterministic-safety";

export type AiContractProbeCheck = {
  name: string;
  repetition: number;
  passed: boolean;
  errorCode?: string;
  detail?: string;
};

export type AiContractProbeReport = {
  provider: string;
  model: string | null;
  repetitions: number;
  passed: boolean;
  checks: AiContractProbeCheck[];
};

type Probe = {
  name: string;
  run: () => Promise<boolean>;
};

/**
 * Opt-in external verification. This function consumes inference and is never
 * called by the standard test suite or at application startup.
 */
export async function runAiProviderContractProbe(
  provider: AiProvider,
  options: { repetitions?: number } = {},
): Promise<AiContractProbeReport> {
  const repetitions = Math.max(1, Math.min(5, options.repetitions ?? 3));
  const completeRequest = {
    goal: "hypertrophy" as const,
    experience: "intermediate" as const,
    daysPerWeek: 4,
    sessionMinutes: 45,
    trainingLocation: "commercial_gym" as const,
    availableEquipment: ["dumbbell", "machine"],
    focusMuscles: ["back"],
    excludedExercises: ["deadlift"],
    excludedMovementPatterns: [],
    preferredExercises: [],
    limitations: [],
    notes: null,
  };
  const plan = {
    routineId: "contract-probe",
    days: [
      {
        dayId: "day-1",
        name: "Torso A",
        exercises: [
          {
            exerciseId: "0047",
            displayName: "Press inclinado con mancuernas",
          },
        ],
      },
    ],
  };

  const probes: Probe[] = [
    {
      name: "complete_request",
      run: async () => {
        const message =
          "Soy intermedio. Quiero hipertrofia cuatro días, 45 minutos por sesión, en gimnasio con mancuernas y máquinas. Evito peso muerto. Confirmo que no tengo dolor, lesiones, síntomas ni restricciones.";
        const turn = await provider.parseRoutineTurn({
          message,
          locale: "es-AR",
        });
        const reconciledTurn = reconcileParsedTurnSafety(
          turn,
          message,
        );
        const result = applyParsedRoutineTurn(
          createEmptyRoutineRequestDraft(),
          "not_confirmed",
          reconciledTurn,
        );
        return (
          result.status === "complete" &&
          toCompleteRoutineRequest(
            result.requestDraft,
            result.limitationsConfirmation,
          ) !== null
        );
      },
    },
    {
      name: "missing_information",
      run: async () => {
        const turn = await provider.parseRoutineTurn({
          message: "Quiero entrenar cuatro días para ganar músculo.",
          locale: "es-AR",
        });
        const result = applyParsedRoutineTurn(
          createEmptyRoutineRequestDraft(),
          "not_confirmed",
          turn,
        );
        return result.status === "needs_input" && result.missingFields.length > 0;
      },
    },
    {
      name: "multi_turn_profile_preservation",
      run: async () => {
        const profileMessage =
          "Quiero una rutina de hipertrofia. Soy intermedio, quiero entrenar cuatro días por semana, una hora por sesión, en un gimnasio completo. Quiero priorizar espalda y bíceps.";
        const profileTurn = reconcileParsedTurnSafety(
          await provider.parseRoutineTurn({
            message: profileMessage,
            locale: "es-AR",
          }),
          profileMessage,
          { hasCurrentRoutine: false },
        );
        const profileResult = applyParsedRoutineTurn(
          createEmptyRoutineRequestDraft(),
          "not_confirmed",
          profileTurn,
        );
        const safetyMessage =
          "No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales que afecten mi entrenamiento.";
        const safetyTurn = reconcileParsedTurnSafety(
          await provider.parseRoutineTurn({
            message: safetyMessage,
            currentDraft: profileResult.requestDraft,
            currentLimitationsConfirmation:
              profileResult.limitationsConfirmation,
            locale: "es-AR",
          }),
          safetyMessage,
          { hasCurrentRoutine: false },
        );
        const result = applyParsedRoutineTurn(
          profileResult.requestDraft,
          profileResult.limitationsConfirmation,
          safetyTurn,
        );

        return (
          result.status === "complete" &&
          result.limitationsConfirmation === "confirmed_none" &&
          result.requestDraft.goal === "hypertrophy" &&
          result.requestDraft.experience === "intermediate" &&
          result.requestDraft.daysPerWeek === 4 &&
          result.requestDraft.sessionMinutes === 60 &&
          result.requestDraft.trainingLocation === "commercial_gym" &&
          result.requestDraft.availableEquipment.length === 0 &&
          result.requestDraft.focusMuscles.length === 2 &&
          result.requestDraft.focusMuscles.includes("back") &&
          result.requestDraft.focusMuscles.includes("biceps")
        );
      },
    },
    {
      name: "conversational_greeting",
      run: async () => {
        const response = await provider.composeAssistantResponse({
          latestIntent: "greeting",
          canonicalDraft: createEmptyRoutineRequestDraft(),
          limitationsConfirmation: "not_confirmed",
          missingFields: [
            "goal",
            "experience",
            "daysPerWeek",
            "sessionMinutes",
            "trainingLocationOrEquipment",
            "limitationsConfirmation",
          ],
          completionPercentage: 0,
          parseStatus: "needs_input",
          safetyResult: {
            status: "needs_review",
            signals: [],
            generationAllowed: false,
          },
          focusedQuestionFields: ["limitationsConfirmation", "goal"],
          validatedPlan: null,
          exerciseContext: null,
          allowedNextActions: [
            "ask_missing_information",
            "open_guided_form",
          ],
          assumptions: [],
          locale: "es-AR",
        });
        return response.message.length > 0 && response.message.length <= 2_000;
      },
    },
    {
      name: "bounded_modification",
      run: async () => {
        const result = await provider.parseRoutineModification({
          message: "Cambiame el press inclinado con mancuernas.",
          currentRequest: completeRequest,
          plan,
          locale: "es-AR",
        });
        return (
          result.status === "ready" &&
          result.modification?.kind === "replace_exercise" &&
          result.modification.dayId === "day-1" &&
          result.modification.exerciseId === "0047"
        );
      },
    },
    {
      name: "deterministic_safety_signal_preserved",
      run: async () => {
        const result = await provider.classifySafety({
          message: "Me lesioné ayer y quiero que me armes una rutina.",
          declaredLimitations: ["Lesión reciente"],
          deterministicSignals: ["recent_injury"],
          locale: "es-AR",
        });
        return (
          result.classification !== "no_signal" &&
          result.signals.includes("recent_injury")
        );
      },
    },
    {
      name: "validated_explanation",
      run: async () => {
        const result = await provider.explainPlan({
          plan: {
            title: "Rutina de prueba",
            goal: "hypertrophy",
            days: [
              {
                name: "Torso A",
                focus: ["back", "chest"],
                estimatedMinutes: 45,
                exercises: [
                  {
                    exerciseId: "0047",
                    displayName: "Press inclinado con mancuernas",
                    sets: 3,
                    repPrescription: "8–12",
                    restSeconds: 90,
                    rir: 2,
                    selectionReasons: ["Compatible con el equipamiento"],
                  },
                ],
              },
            ],
            warnings: [],
            assumptions: [],
            validationSummary: "Plan validado por el motor determinístico.",
          },
          question: "¿Por qué se eligió este ejercicio?",
          locale: "es-AR",
        });
        const normalized = result.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
        return (
          result.length > 0 &&
          result.length <= 2_000 &&
          (normalized.includes("press inclinado") ||
            normalized.includes("mancuernas") ||
            normalized.includes("equipamiento") ||
            normalized.includes("rir"))
        );
      },
    },
  ];

  const checks: AiContractProbeCheck[] = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    for (const probe of probes) {
      try {
        const passed = await probe.run();
        checks.push({
          name: probe.name,
          repetition,
          passed,
          ...(passed ? {} : { detail: "La respuesta validó pero no cumplió la semántica esperada." }),
        });
      } catch (error) {
        checks.push({
          name: probe.name,
          repetition,
          passed: false,
          errorCode: isAiProviderError(error) ? error.code : "unexpected_error",
          detail: isAiProviderError(error)
            ? error.message
            : "Error inesperado durante el contrato.",
        });
      }
    }
  }

  return {
    provider: provider.id,
    model: provider.model,
    repetitions,
    passed: checks.every((check) => check.passed),
    checks,
  };
}
