import type { RoutinePlan } from "../../domain/routine/schemas";
import type { RoutineValidationResult } from "../../domain/routine/validators/validate-routine";

export type RoutineMutationErrorCode =
  | "DAY_NOT_FOUND"
  | "EXERCISE_NOT_FOUND"
  | "INVALID_POSITION"
  | "INVALID_PRESCRIPTION"
  | "INVALID_ROUTINE"
  | "NO_SUBSTITUTION"
  | "INELIGIBLE_REPLACEMENT"
  | "INSUFFICIENT_CATALOG";

export type RoutineMutationSuccess = {
  ok: true;
  plan: RoutinePlan;
  validation: RoutineValidationResult;
};

export type RoutineMutationFailure = {
  ok: false;
  code: RoutineMutationErrorCode;
  message: string;
  candidatePlan?: RoutinePlan;
  validation?: RoutineValidationResult;
};

export type RoutineMutationResult =
  | RoutineMutationSuccess
  | RoutineMutationFailure;
