import "server-only";

import { z } from "zod";

import type { AiProvider } from "../ai-provider";
import { AiProviderError, type AiErrorCode } from "../errors";
import { AI_LIMITS } from "../limits";
import { assertMaximumBytes, withAiDeadline } from "../runtime";
import {
  createRoutineModificationResultSchema,
  createSafetyClassificationSchema,
  ExplainPlanInputDataSchema,
  ParseRoutineInputDataSchema,
  ParseRoutineModificationInputDataSchema,
  ParseRoutineResultSchema,
  SafetyClassificationInputDataSchema,
  type ExplainPlanInput,
  type ParseRoutineInput,
  type ParseRoutineModificationInput,
  type ParseRoutineResult,
  type RoutineModificationResult,
  type RoutineRequestDraft,
  type SafetyClassification,
  type SafetyClassificationInput,
  type SafetySignalSchema,
} from "../schemas";
import type { AiOperation } from "../structured-output";

type ParsedRoutineInput = z.output<typeof ParseRoutineInputDataSchema>;
type ParsedModificationInput = z.output<
  typeof ParseRoutineModificationInputDataSchema
>;
type ParsedSafetyInput = z.output<typeof SafetyClassificationInputDataSchema>;
type ParsedExplanationInput = z.output<typeof ExplainPlanInputDataSchema>;
type SafetySignal = z.infer<typeof SafetySignalSchema>;

export type MockResponseOverrides = {
  parseRoutineRequest?:
    | ParseRoutineResult
    | ((input: ParsedRoutineInput) => ParseRoutineResult);
  parseRoutineModification?:
    | RoutineModificationResult
    | ((input: ParsedModificationInput) => RoutineModificationResult);
  classifySafety?:
    | SafetyClassification
    | ((input: ParsedSafetyInput) => SafetyClassification);
  explainPlan?: string | ((input: ParsedExplanationInput) => string);
};

export type MockAiProviderConfig = {
  responses?: MockResponseOverrides;
  errors?: Partial<Record<AiOperation, AiErrorCode>>;
  delayMs?: number | Partial<Record<AiOperation, number>>;
  timeoutMs?: number;
};

const EMPTY_DRAFT: RoutineRequestDraft = {
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  trainingLocation: null,
  availableEquipment: [],
  focusMuscles: [],
  excludedExercises: [],
  excludedMovementPatterns: [],
  preferredExercises: [],
  limitations: [],
  notes: null,
};

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-AR");
}

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

const SPANISH_NUMBERS: Record<string, number> = {
  uno: 1,
  un: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  quince: 15,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  cuarenta_y_cinco: 45,
  cincuenta: 50,
  sesenta: 60,
  noventa: 90,
};

function extractNumberBefore(
  value: string,
  suffixPattern: string,
): number | null {
  const numeric = value.match(new RegExp(`\\b(\\d{1,3})\\s*${suffixPattern}`));
  if (numeric?.[1]) {
    return Number(numeric[1]);
  }

  for (const [word, number] of Object.entries(SPANISH_NUMBERS)) {
    const phrase = word.replaceAll("_", " ");
    if (new RegExp(`\\b${phrase}\\s+${suffixPattern}`).test(value)) {
      return number;
    }
  }
  return null;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function detectSafetySignals(value: string): SafetySignal[] {
  const signals: SafetySignal[] = [];
  if (includesAny(value, ["me lesione", "lesion reciente", "lesionado ayer"])) {
    signals.push("recent_injury");
  }
  if (includesAny(value, ["rehabilit", "rehab"] )) {
    signals.push("rehabilitation_request");
  }
  if (includesAny(value, ["me operaron", "operacion reciente", "postoperatorio"])) {
    signals.push("recent_operation");
  }
  if (includesAny(value, ["me duele", "dolor al", "dolor durante"])) {
    signals.push("pain_during_movement");
  }
  if (includesAny(value, ["diagnosticame", "que enfermedad tengo"])) {
    signals.push("diagnosis_request");
  }
  if (includesAny(value, ["embarazada", "embarazo"])) {
    signals.push("pregnancy_specific");
  }
  if (includesAny(value, ["suplemento", "creatina", "medicacion"])) {
    signals.push(value.includes("medicacion") ? "medication_advice" : "supplement_advice");
  }
  return unique(signals) as SafetySignal[];
}

function parseMockRoutine(input: ParsedRoutineInput): ParseRoutineResult {
  const text = normalized(input.message);
  const draft: RoutineRequestDraft = {
    ...(input.currentDraft ?? EMPTY_DRAFT),
    availableEquipment: [...(input.currentDraft?.availableEquipment ?? [])],
    focusMuscles: [...(input.currentDraft?.focusMuscles ?? [])],
    excludedExercises: [...(input.currentDraft?.excludedExercises ?? [])],
    excludedMovementPatterns: [
      ...(input.currentDraft?.excludedMovementPatterns ?? []),
    ],
    preferredExercises: [...(input.currentDraft?.preferredExercises ?? [])],
    limitations: [...(input.currentDraft?.limitations ?? [])],
  };

  if (includesAny(text, ["hipertrof", "ganar musculo", "masa muscular"])) {
    draft.goal = "hypertrophy";
  } else if (includesAny(text, ["fuerza", "mas fuerte"])) {
    draft.goal = "strength";
  } else if (includesAny(text, ["resistencia muscular"])) {
    draft.goal = "muscular_endurance";
  } else if (includesAny(text, ["estado fisico", "fitness general", "salud general"])) {
    draft.goal = "general_fitness";
  }

  if (text.includes("principiante")) draft.experience = "beginner";
  if (text.includes("intermedio")) draft.experience = "intermediate";
  if (text.includes("avanzado")) draft.experience = "advanced";

  const days = extractNumberBefore(text, "(?:dias|veces)(?: por semana)?");
  if (days !== null && days >= 1 && days <= 6) draft.daysPerWeek = days;

  const minutes = extractNumberBefore(text, "minutos?|min\\b");
  if (minutes !== null && minutes >= 15 && minutes <= 180) {
    draft.sessionMinutes = minutes;
  }

  if (includesAny(text, ["en casa", "en mi casa", "hogar"])) {
    draft.trainingLocation = "home";
  }
  if (includesAny(text, ["gimnasio", "gym comercial"])) {
    draft.trainingLocation = "commercial_gym";
  }

  const equipment = [...draft.availableEquipment];
  const mentionedEquipment = includesAny(text, [
    "mancuerna",
    "barra",
    "polea",
    "cable",
    "maquina",
    "banda",
    "peso corporal",
    "sin equipo",
  ]);
  if (text.includes("mancuerna")) equipment.push("dumbbell");
  if (text.includes("barra")) equipment.push("barbell");
  if (includesAny(text, ["polea", "cable"])) equipment.push("cable");
  if (includesAny(text, ["maquina", "maquinas"])) equipment.push("machine");
  if (text.includes("banda")) equipment.push("resistance_band");
  if (includesAny(text, ["peso corporal", "sin equipo"])) equipment.push("body_weight");
  draft.availableEquipment = unique(equipment);
  if (mentionedEquipment && draft.trainingLocation === null) {
    draft.trainingLocation = "custom";
  }

  const focus = [...draft.focusMuscles];
  if (text.includes("pecho")) focus.push("chest");
  if (text.includes("espalda")) focus.push("back");
  if (text.includes("hombro")) focus.push("shoulders");
  if (text.includes("pierna")) focus.push("legs");
  draft.focusMuscles = unique(focus);

  if (includesAny(text, ["no quiero hacer peso muerto", "sin peso muerto"])) {
    draft.excludedExercises = unique([
      ...draft.excludedExercises,
      "deadlift",
    ]);
  }

  let limitationsConfirmation = input.currentLimitationsConfirmation;
  if (
    includesAny(text, [
      "no tengo dolor",
      "sin dolor ni restricciones",
      "no tengo lesiones",
      "sin limitaciones",
    ])
  ) {
    limitationsConfirmation = "confirmed_none";
  }

  const safetySignals = detectSafetySignals(text);
  if (safetySignals.length > 0) {
    draft.limitations = unique([...draft.limitations, input.message.trim()]);
    limitationsConfirmation = "confirmed_with_limitations";
  }

  const missingFields: ParseRoutineResult["missingFields"] = [];
  if (draft.goal === null) missingFields.push("goal");
  if (draft.experience === null) missingFields.push("experience");
  if (draft.daysPerWeek === null) missingFields.push("daysPerWeek");
  if (draft.sessionMinutes === null) missingFields.push("sessionMinutes");
  if (draft.trainingLocation === null && draft.availableEquipment.length === 0) {
    missingFields.push("trainingLocationOrEquipment");
  }
  if (limitationsConfirmation === "not_confirmed") {
    missingFields.push("limitationsConfirmation");
  }

  const unsupported = safetySignals.some((signal) =>
    [
      "recent_injury",
      "recent_operation",
      "rehabilitation_request",
      "diagnosis_request",
      "pregnancy_specific",
      "medication_advice",
      "supplement_advice",
    ].includes(signal),
  );

  return ParseRoutineResultSchema.parse({
    status: unsupported
      ? "unsupported"
      : missingFields.length > 0
        ? "needs_input"
        : "complete",
    request: draft,
    limitationsConfirmation,
    missingFields,
    assumptions: [],
    safetySignals,
  });
}

function parseMockModification(
  input: ParsedModificationInput,
): RoutineModificationResult {
  const text = normalized(input.message);
  const safetySignals = detectSafetySignals(text);
  if (safetySignals.length > 0) {
    return {
      status: "unsupported",
      modification: null,
      clarificationQuestion: null,
      safetySignals,
      assumptions: [],
    };
  }

  const minutes = extractNumberBefore(text, "minutos?|min\\b");
  if (minutes !== null && minutes >= 15 && minutes <= 180) {
    return {
      status: "ready",
      modification: {
        kind: "update_request",
        patch: { sessionMinutes: minutes },
      },
      clarificationQuestion: null,
      safetySignals: [],
      assumptions: [],
    };
  }

  if (text.includes("priorizar") && text.includes("espalda")) {
    return {
      status: "ready",
      modification: {
        kind: "update_request",
        patch: { focusMuscles: ["back"] },
      },
      clarificationQuestion: null,
      safetySignals: [],
      assumptions: [],
    };
  }

  const exercises = input.plan.days.flatMap((day) =>
    day.exercises.map((exercise) => ({ ...exercise, dayId: day.dayId })),
  );
  const matches = exercises.filter((exercise) => {
    const name = normalized(exercise.displayName);
    return text.includes(name) || name.split(" ").every((word) => text.includes(word));
  });

  if (includesAny(text, ["cambia", "cambiame", "reemplaza"])) {
    if (matches.length === 1) {
      return {
        status: "ready",
        modification: {
          kind: "replace_exercise",
          dayId: matches[0]!.dayId,
          exerciseId: matches[0]!.exerciseId,
          requestedAlternative: null,
        },
        clarificationQuestion: null,
        safetySignals: [],
        assumptions: [],
      };
    }
    return {
      status: "needs_clarification",
      modification: null,
      clarificationQuestion: "¿Qué ejercicio querés reemplazar?",
      safetySignals: [],
      assumptions: [],
    };
  }

  if (includesAny(text, ["saca", "elimina", "quita"])) {
    if (matches.length === 1) {
      return {
        status: "ready",
        modification: {
          kind: "remove_exercise",
          dayId: matches[0]!.dayId,
          exerciseId: matches[0]!.exerciseId,
        },
        clarificationQuestion: null,
        safetySignals: [],
        assumptions: [],
      };
    }
    return {
      status: "needs_clarification",
      modification: null,
      clarificationQuestion: "¿Qué ejercicio querés quitar?",
      safetySignals: [],
      assumptions: [],
    };
  }

  if (text.includes("regenera")) {
    const day = input.plan.days.find((candidate) =>
      text.includes(normalized(candidate.name)),
    );
    if (day) {
      return {
        status: "ready",
        modification: { kind: "regenerate_day", dayId: day.dayId },
        clarificationQuestion: null,
        safetySignals: [],
        assumptions: [],
      };
    }
  }

  return {
    status: "needs_clarification",
    modification: null,
    clarificationQuestion: "¿Qué parte de la rutina querés cambiar?",
    safetySignals: [],
    assumptions: [],
  };
}

function classifyMockSafety(input: ParsedSafetyInput): SafetyClassification {
  const signals = unique([
    ...input.deterministicSignals,
    ...detectSafetySignals(normalized(input.message)),
  ]) as SafetySignal[];
  const unsupported = signals.some((signal) =>
    [
      "recent_injury",
      "recent_operation",
      "rehabilitation_request",
      "diagnosis_request",
      "pregnancy_specific",
      "minor",
      "complex_medical_condition",
      "medication_advice",
      "supplement_advice",
      "extreme_weight_loss",
      "eating_disorder_related",
    ].includes(signal),
  );
  if (unsupported) {
    return {
      classification: "unsupported_signal",
      signals,
      reason: "El pedido contiene señales que están fuera del alcance de FORMA.",
      clarificationQuestion: null,
    };
  }
  if (signals.length > 0) {
    return {
      classification: "needs_review",
      signals,
      reason: "Hace falta aclarar la limitación antes de continuar.",
      clarificationQuestion:
        "¿Tenés indicaciones profesionales claras sobre qué movimientos evitar?",
    };
  }
  return {
    classification: "no_signal",
    signals: [],
    reason: "No se detectaron señales de seguridad en el texto.",
    clarificationQuestion: null,
  };
}

function validateInput<TSchema extends z.ZodType>(
  input: z.input<TSchema> & { signal?: AbortSignal },
  schema: TSchema,
  operation: AiOperation,
): { data: z.output<TSchema>; signal?: AbortSignal } {
  const { signal, ...untrusted } = input;
  const parsed = schema.safeParse(untrusted);
  if (!parsed.success) {
    throw new AiProviderError("invalid_input", {
      provider: "mock",
      operation,
      cause: parsed.error.issues,
    });
  }
  assertMaximumBytes({
    value: JSON.stringify(parsed.data),
    maximum: AI_LIMITS.inputBytes,
    kind: "input",
    provider: "mock",
    operation,
  });
  return { data: parsed.data, ...(signal ? { signal } : {}) };
}

export class MockAiProvider implements AiProvider {
  readonly id = "mock" as const;
  readonly model = "deterministic-fixture-v1";

  private readonly config: MockAiProviderConfig;

  constructor(config: MockAiProviderConfig = {}) {
    this.config = config;
  }

  private delayFor(operation: AiOperation): number {
    return typeof this.config.delayMs === "number"
      ? this.config.delayMs
      : (this.config.delayMs?.[operation] ?? 0);
  }

  private async beforeCall(
    operation: AiOperation,
    signal?: AbortSignal,
  ): Promise<void> {
    const configuredError = this.config.errors?.[operation];
    if (configuredError) {
      throw new AiProviderError(configuredError, {
        provider: this.id,
        operation,
      });
    }

    const delayMs = this.delayFor(operation);
    if (delayMs === 0 && !signal?.aborted) {
      return;
    }

    await withAiDeadline({
      provider: this.id,
      operation,
      timeoutMs: this.config.timeoutMs ?? AI_LIMITS.defaultTimeoutMs,
      ...(signal ? { signal } : {}),
      run: (deadlineSignal) =>
        new Promise<void>((resolve, reject) => {
          if (deadlineSignal.aborted) {
            reject(deadlineSignal.reason);
            return;
          }
          const timeout = setTimeout(resolve, delayMs);
          deadlineSignal.addEventListener(
            "abort",
            () => {
              clearTimeout(timeout);
              reject(deadlineSignal.reason);
            },
            { once: true },
          );
        }),
    });
  }

  private validateOutput<TSchema extends z.ZodType>(
    value: unknown,
    schema: TSchema,
    operation: AiOperation,
  ): z.output<TSchema> {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new AiProviderError("invalid_output", {
        provider: this.id,
        operation,
        cause: parsed.error.issues,
        message: "Configured mock output is invalid",
      });
    }
    assertMaximumBytes({
      value: JSON.stringify(parsed.data),
      maximum: AI_LIMITS.outputBytes,
      kind: "output",
      provider: this.id,
      operation,
    });
    return parsed.data;
  }

  async parseRoutineRequest(
    input: ParseRoutineInput,
  ): Promise<ParseRoutineResult> {
    const parsed = validateInput(
      input,
      ParseRoutineInputDataSchema,
      "parse_routine_request",
    );
    await this.beforeCall("parse_routine_request", parsed.signal);
    const override = this.config.responses?.parseRoutineRequest;
    const output =
      typeof override === "function"
        ? override(parsed.data)
        : (override ?? parseMockRoutine(parsed.data));
    return this.validateOutput(
      output,
      ParseRoutineResultSchema,
      "parse_routine_request",
    );
  }

  async parseRoutineModification(
    input: ParseRoutineModificationInput,
  ): Promise<RoutineModificationResult> {
    const parsed = validateInput(
      input,
      ParseRoutineModificationInputDataSchema,
      "parse_routine_modification",
    );
    await this.beforeCall("parse_routine_modification", parsed.signal);
    const override = this.config.responses?.parseRoutineModification;
    const output =
      typeof override === "function"
        ? override(parsed.data)
        : (override ?? parseMockModification(parsed.data));
    return this.validateOutput(
      output,
      createRoutineModificationResultSchema(parsed.data),
      "parse_routine_modification",
    );
  }

  async classifySafety(
    input: SafetyClassificationInput,
  ): Promise<SafetyClassification> {
    const parsed = validateInput(
      input,
      SafetyClassificationInputDataSchema,
      "classify_safety",
    );
    await this.beforeCall("classify_safety", parsed.signal);
    const override = this.config.responses?.classifySafety;
    const output =
      typeof override === "function"
        ? override(parsed.data)
        : (override ?? classifyMockSafety(parsed.data));
    return this.validateOutput(
      output,
      createSafetyClassificationSchema(parsed.data.deterministicSignals),
      "classify_safety",
    );
  }

  async explainPlan(input: ExplainPlanInput): Promise<string> {
    const parsed = validateInput(
      input,
      ExplainPlanInputDataSchema,
      "explain_plan",
    );
    await this.beforeCall("explain_plan", parsed.signal);
    const override = this.config.responses?.explainPlan;
    const output =
      typeof override === "function"
        ? override(parsed.data)
        : (override ??
          `La rutina ${parsed.data.plan.title} fue validada con ${parsed.data.plan.days.length} días. Las decisiones de ejercicios, volumen y duración provienen del motor determinístico.`);
    if (typeof output !== "string" || output.trim().length === 0) {
      throw new AiProviderError("invalid_output", {
        provider: this.id,
        operation: "explain_plan",
      });
    }
    assertMaximumBytes({
      value: output,
      maximum: AI_LIMITS.outputBytes,
      kind: "output",
      provider: this.id,
      operation: "explain_plan",
    });
    if (output.length > AI_LIMITS.explanationCharacters) {
      throw new AiProviderError("invalid_output", {
        provider: this.id,
        operation: "explain_plan",
      });
    }
    return output.trim();
  }
}
