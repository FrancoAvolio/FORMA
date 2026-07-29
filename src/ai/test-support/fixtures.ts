import type { AiProvider } from "../ai-provider";
import type { RoutineRequest } from "../../domain/profile/routine-request";
import type {
  AssistantResponse,
  ComposeAssistantResponseInput,
  ExplainPlanInput,
  ParsedRoutineTurn,
  ParseRoutineTurnInput,
  ParseRoutineModificationInput,
  RoutinePlanContextSchema,
  RoutineModificationResult,
  SafetyClassification,
  SafetyClassificationInput,
} from "../schemas";
import type { z } from "zod";

export const completeRoutineRequest: RoutineRequest = {
  goal: "hypertrophy",
  experience: "intermediate",
  daysPerWeek: 4,
  sessionMinutes: 45,
  trainingLocation: "commercial_gym",
  availableEquipment: ["dumbbell", "machine"],
  focusMuscles: ["back"],
  excludedExercises: ["deadlift"],
  excludedMovementPatterns: [],
  preferredExercises: [],
  limitations: [],
  notes: null,
};

export const completeParseInput: ParseRoutineTurnInput = {
  message:
    "Soy intermedio, quiero hipertrofia cuatro días, 45 minutos, en el gimnasio con mancuernas y máquinas, prioridad en espalda y sin peso muerto. No tengo dolor al moverme, lesiones recientes, operaciones recientes, restricciones médicas, síntomas durante el ejercicio ni indicaciones profesionales.",
  locale: "es-AR",
};

export const completeParsedTurn: ParsedRoutineTurn = {
  intent: "provide_information",
  requestPatch: { ...completeRoutineRequest },
  limitationsConfirmation: "no_limitations",
  assumptions: [],
  safetySignals: [],
};

export const planContext: z.input<typeof RoutinePlanContextSchema> = {
  routineId: "routine-1",
  days: [
    {
      dayId: "day-1",
      name: "Torso A",
      exercises: [
        {
          exerciseId: "0047",
          displayName: "Press inclinado con mancuernas",
        },
        { exerciseId: "0152", displayName: "Remo en polea" },
      ],
    },
  ],
};

export const modificationInput: ParseRoutineModificationInput = {
  message: "Cambiame el press inclinado con mancuernas.",
  currentRequest: { ...completeRoutineRequest },
  plan: planContext,
  locale: "es-AR",
};

export const modificationResult: RoutineModificationResult = {
  status: "ready",
  modification: {
    kind: "replace_exercise",
    dayId: "day-1",
    exerciseId: "0047",
    requestedAlternative: null,
  },
  clarificationQuestion: null,
  safetySignals: [],
  assumptions: [],
};

export const safetyInput: SafetyClassificationInput = {
  message: "No tengo dolor ni restricciones.",
  declaredLimitations: [],
  deterministicSignals: [],
  locale: "es-AR",
};

export const safetyResult: SafetyClassification = {
  classification: "no_signal",
  signals: [],
  reason: "No se detectaron señales de seguridad en el texto.",
  clarificationQuestion: null,
};

export const explanationInput: ExplainPlanInput = {
  plan: {
    title: "Torso y piernas",
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
    validationSummary: "El motor determinístico validó la rutina.",
  },
  question: "¿Por qué está este ejercicio?",
  locale: "es-AR",
};

export const explanationResult = {
  explanation:
    "El press inclinado fue seleccionado por ser compatible con el equipamiento indicado. El RIR 2 señala que se dejan dos repeticiones en reserva.",
} as const;

export const assistantResponseInput: ComposeAssistantResponseInput = {
  latestIntent: "provide_information",
  canonicalDraft: { ...completeRoutineRequest },
  limitationsConfirmation: "confirmed_none",
  missingFields: [],
  completionPercentage: 100,
  parseStatus: "complete",
  safetyResult: {
    status: "clear",
    signals: [],
    generationAllowed: true,
  },
  focusedQuestionFields: [],
  validatedPlan: explanationInput.plan,
  exerciseContext: null,
  allowedNextActions: ["show_routine", "modify_routine", "save_routine"],
  assumptions: [],
  locale: "es-AR",
};

export const assistantResponseResult: AssistantResponse = {
  message:
    "Listo. Armé una rutina validada de un día con ejercicios compatibles con tus datos.",
};

export function responseForOperation(
  operation: string,
): unknown {
  switch (operation) {
    case "parse_routine_turn":
      return completeParsedTurn;
    case "compose_assistant_response":
      return assistantResponseResult;
    case "parse_routine_modification":
      return modificationResult;
    case "classify_safety":
      return safetyResult;
    case "explain_plan":
      return explanationResult;
    default:
      throw new Error(`Unknown fixture operation: ${operation}`);
  }
}

export type ProviderFactory = () => AiProvider;
