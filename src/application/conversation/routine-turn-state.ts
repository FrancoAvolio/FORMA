import type { RoutineRequest } from "../../domain/profile/routine-request";
import {
  LimitationsConfirmationSchema,
  REQUIRED_ROUTINE_FIELD_VALUES,
  RoutineRequestDraftSchema,
  type LimitationsConfirmation,
  type RequiredRoutineField,
  type RoutineRequestDraft,
} from "../../domain/profile/routine-draft";
import { RoutineRequestSchema } from "../../domain/profile/routine-request";
import {
  LatestTurnLimitationsConfirmationSchema,
  ParsedRoutineTurnSchema,
  RoutineRequestPatchSchema,
  type LatestTurnLimitationsConfirmation,
  type ParsedRoutineTurn,
  type RoutineRequestPatch,
  type RoutineTurnIntent,
} from "../../ai/schemas/routine-request";
import {
  SafetySignalsListSchema,
  type SafetySignalSchema,
} from "../../ai/schemas/safety";
import {
  createEmptyConversationalSafetyScreeningDraft,
  deriveConversationalSafetyStatus,
  deriveMissingSafetyFields,
  extractConversationalSafetyPatch,
  mergeConversationalSafetyPatch,
  type ConversationalSafetyScreeningDraft,
  type ConversationalSafetyStatus,
} from "../../domain/safety/conversational-screening";
import type { z } from "zod";

export const ROUTINE_PARSE_STATUS_VALUES = [
  "complete",
  "needs_input",
  "unsupported",
] as const;

export type RoutineParseStatus =
  (typeof ROUTINE_PARSE_STATUS_VALUES)[number];

type SafetySignal = z.output<typeof SafetySignalSchema>;

export type DerivedRoutineTurnResult = {
  intent: RoutineTurnIntent;
  requestDraft: RoutineRequestDraft;
  limitationsConfirmation: LimitationsConfirmation;
  missingFields: RequiredRoutineField[];
  completionPercentage: number;
  status: RoutineParseStatus;
  safetySignals: SafetySignal[];
  assumptions: string[];
  screeningDraft: ConversationalSafetyScreeningDraft;
  safetyMissingFields: ReturnType<typeof deriveMissingSafetyFields>;
  safetyStatus: ConversationalSafetyStatus;
};

/**
 * Applies only keys present in the latest-turn patch. Arrays are replaced as a
 * unit; null explicitly clears a scalar or list. Inputs are parsed again so
 * callers cannot bypass the canonical draft constraints with a type assertion.
 */
export function mergeRoutineRequestPatch(
  currentDraft: RoutineRequestDraft,
  requestPatch: RoutineRequestPatch,
): RoutineRequestDraft {
  const current = RoutineRequestDraftSchema.parse(currentDraft);
  const patch = RoutineRequestPatchSchema.parse(requestPatch);

  return RoutineRequestDraftSchema.parse({
    goal: patch.goal === undefined ? current.goal : patch.goal,
    experience:
      patch.experience === undefined
        ? current.experience
        : patch.experience,
    daysPerWeek:
      patch.daysPerWeek === undefined
        ? current.daysPerWeek
        : patch.daysPerWeek,
    sessionMinutes:
      patch.sessionMinutes === undefined
        ? current.sessionMinutes
        : patch.sessionMinutes,
    trainingLocation:
      patch.trainingLocation === undefined
        ? current.trainingLocation
        : patch.trainingLocation,
    availableEquipment:
      patch.availableEquipment === undefined
        ? [...current.availableEquipment]
        : [...(patch.availableEquipment ?? [])],
    focusMuscles:
      patch.focusMuscles === undefined
        ? [...current.focusMuscles]
        : [...(patch.focusMuscles ?? [])],
    excludedExercises:
      patch.excludedExercises === undefined
        ? [...current.excludedExercises]
        : [...(patch.excludedExercises ?? [])],
    excludedMovementPatterns:
      patch.excludedMovementPatterns === undefined
        ? [...current.excludedMovementPatterns]
        : [...(patch.excludedMovementPatterns ?? [])],
    preferredExercises:
      patch.preferredExercises === undefined
        ? [...current.preferredExercises]
        : [...(patch.preferredExercises ?? [])],
    limitations:
      patch.limitations === undefined
        ? [...current.limitations]
        : [...(patch.limitations ?? [])],
    notes: patch.notes === undefined ? current.notes : patch.notes,
  });
}

export function mergeLimitationsConfirmation(
  current: LimitationsConfirmation,
  latestTurn: LatestTurnLimitationsConfirmation,
): LimitationsConfirmation {
  const canonical = LimitationsConfirmationSchema.parse(current);
  const turn = LatestTurnLimitationsConfirmationSchema.parse(latestTurn);

  switch (turn) {
    case "unknown":
      return canonical;
    case "no_limitations":
      return "confirmed_none";
    case "has_limitations":
      return "confirmed_with_limitations";
  }
}

export function deriveMissingFields(
  requestDraft: RoutineRequestDraft,
  limitationsConfirmation: LimitationsConfirmation,
): RequiredRoutineField[] {
  const draft = RoutineRequestDraftSchema.parse(requestDraft);
  const confirmation = LimitationsConfirmationSchema.parse(
    limitationsConfirmation,
  );
  const missing: RequiredRoutineField[] = [];

  if (draft.goal === null) missing.push("goal");
  if (draft.experience === null) missing.push("experience");
  if (draft.daysPerWeek === null) missing.push("daysPerWeek");
  if (draft.sessionMinutes === null) missing.push("sessionMinutes");
  if (
    draft.trainingLocation === null &&
    draft.availableEquipment.length === 0
  ) {
    missing.push("trainingLocationOrEquipment");
  }
  if (confirmation === "not_confirmed") {
    missing.push("limitationsConfirmation");
  }

  return missing;
}

export function deriveProfileCompletion(
  requestDraft: RoutineRequestDraft,
  limitationsConfirmation: LimitationsConfirmation,
): number {
  const missingCount = deriveMissingFields(
    requestDraft,
    limitationsConfirmation,
  ).length;
  const total = REQUIRED_ROUTINE_FIELD_VALUES.length;
  return Math.round(((total - missingCount) / total) * 100);
}

const FOLLOW_UP_PRIORITY: readonly RequiredRoutineField[] = [
  "limitationsConfirmation",
  "goal",
  "daysPerWeek",
  "experience",
  "sessionMinutes",
  "trainingLocationOrEquipment",
];

/** Selects at most two related facts; the UI may still display every missing field. */
export function selectFocusedQuestionFields(
  missingFields: readonly RequiredRoutineField[],
): RequiredRoutineField[] {
  const missing = new Set(missingFields);
  return FOLLOW_UP_PRIORITY.filter((field) => missing.has(field)).slice(0, 2);
}

export function deriveParseStatus(
  requestDraft: RoutineRequestDraft,
  limitationsConfirmation: LimitationsConfirmation,
  safetySignals: readonly SafetySignal[],
  screeningDraft?: ConversationalSafetyScreeningDraft,
): RoutineParseStatus {
  const signals = SafetySignalsListSchema.parse(safetySignals);
  if (
    signals.length > 0 ||
    (screeningDraft &&
      deriveConversationalSafetyStatus(screeningDraft, signals) === "blocked")
  ) {
    return "unsupported";
  }
  return deriveMissingFields(requestDraft, limitationsConfirmation).length === 0
    ? "complete"
    : "needs_input";
}

/**
 * Builds the canonical, derived result after validating and merging hostile
 * model output. Explicit "no limitations" also clears stale limitation text.
 */
export function applyParsedRoutineTurn(
  currentDraft: RoutineRequestDraft,
  currentLimitationsConfirmation: LimitationsConfirmation,
  parsedTurn: ParsedRoutineTurn,
  options: {
    rawMessage?: string;
    screeningDraft?: ConversationalSafetyScreeningDraft;
  } = {},
): DerivedRoutineTurnResult {
  // Retained in the function signature for callers migrating from the legacy
  // coarse field; the field-level draft is now authoritative.
  void currentLimitationsConfirmation;
  const turn = ParsedRoutineTurnSchema.parse(parsedTurn);
  let requestDraft = mergeRoutineRequestPatch(
    currentDraft,
    turn.requestPatch,
  );
  const currentSafetyDraft =
    options.screeningDraft ?? createEmptyConversationalSafetyScreeningDraft();
  const latestSafetyPatch = options.rawMessage
    ? extractConversationalSafetyPatch(options.rawMessage)
    : {};
  const screeningDraft = mergeConversationalSafetyPatch(
    currentSafetyDraft,
    latestSafetyPatch,
  );
  const safetyStatus = deriveConversationalSafetyStatus(
    screeningDraft,
    turn.safetySignals,
  );
  const limitationsConfirmation: LimitationsConfirmation =
    safetyStatus === "eligible"
      ? "confirmed_none"
      : safetyStatus === "blocked"
        ? "confirmed_with_limitations"
        : "not_confirmed";

  if (safetyStatus === "eligible" && Object.keys(latestSafetyPatch).length > 0) {
    requestDraft = mergeRoutineRequestPatch(requestDraft, { limitations: [] });
  }

  const missingFields = deriveMissingFields(
    requestDraft,
    limitationsConfirmation,
  );
  return {
    intent: turn.intent,
    requestDraft,
    limitationsConfirmation,
    missingFields,
    completionPercentage: deriveProfileCompletion(
      requestDraft,
      limitationsConfirmation,
    ),
    status: deriveParseStatus(requestDraft, limitationsConfirmation, turn.safetySignals, screeningDraft),
    safetySignals: [...turn.safetySignals],
    assumptions: [...turn.assumptions],
    screeningDraft,
    safetyMissingFields: deriveMissingSafetyFields(screeningDraft),
    safetyStatus,
  };
}

/** Converts canonical application state—not model output—to the domain input. */
export function toCompleteRoutineRequest(
  requestDraft: RoutineRequestDraft,
  limitationsConfirmation: LimitationsConfirmation,
): RoutineRequest | null {
  const draft = RoutineRequestDraftSchema.parse(requestDraft);
  if (deriveMissingFields(draft, limitationsConfirmation).length > 0) {
    return null;
  }

  const candidate = {
    ...draft,
    goal: draft.goal ?? undefined,
    experience: draft.experience ?? undefined,
    daysPerWeek: draft.daysPerWeek ?? undefined,
    sessionMinutes: draft.sessionMinutes ?? undefined,
    trainingLocation:
      draft.trainingLocation ??
      (draft.availableEquipment.length > 0 ? "custom" : undefined),
  };
  const result = RoutineRequestSchema.safeParse(candidate);
  return result.success ? result.data : null;
}
