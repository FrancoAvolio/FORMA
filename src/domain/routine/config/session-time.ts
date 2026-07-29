export const SESSION_TIME_RULES = {
  /** Legacy fallback used only when a caller has no explicit session blocks. */
  warmupMinutes: 6,
  transitionSeconds: 75,
  repetitionSeconds: 4,
  unilateralRepetitionMultiplier: 1.45,
  minimumExerciseCount: 3,
  maximumExerciseCount: 12,
  lowerToleranceMinutes: 5,
  upperToleranceMinutes: 6,
  restAdjustmentSeconds: 15,
  maximumFitIterations: 800,
} as const;

export type SessionTimeBounds = {
  lower: number;
  target: number;
  upper: number;
};

export type SessionBlockBudget = {
  generalWarmupMinutes: number;
  specificPreparationMinutes: number;
  cooldownMinutes: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Shared target band for generation and validation. */
export function sessionTimeBounds(sessionMinutes: number): SessionTimeBounds {
  return {
    lower: Math.max(1, sessionMinutes - SESSION_TIME_RULES.lowerToleranceMinutes),
    target: sessionMinutes,
    upper: sessionMinutes + SESSION_TIME_RULES.upperToleranceMinutes,
  };
}

/**
 * Visible non-working blocks scale with the requested session instead of
 * padding every plan with a fixed hidden allowance.
 */
export function sessionBlockBudget(
  sessionMinutes: number,
): SessionBlockBudget {
  return {
    generalWarmupMinutes: clamp(Math.ceil(sessionMinutes * 0.09), 2, 8),
    specificPreparationMinutes: clamp(
      Math.ceil(sessionMinutes * 0.09),
      2,
      8,
    ),
    cooldownMinutes: clamp(Math.ceil(sessionMinutes * 0.05), 1, 5),
  };
}

export function exerciseCountForSession(
  sessionMinutes: number,
  goal: "hypertrophy" | "strength" | "general_fitness" | "muscular_endurance",
): number {
  const baseCount =
    sessionMinutes < 30
      ? 3
      : sessionMinutes < 40
        ? 4
        : sessionMinutes < 55
          ? 5
          : sessionMinutes < 75
            ? 6
            : 7;

  const goalAdjustment = goal === "strength" && sessionMinutes < 55 ? -1 : 0;
  return Math.min(
    SESSION_TIME_RULES.maximumExerciseCount,
    Math.max(SESSION_TIME_RULES.minimumExerciseCount, baseCount + goalAdjustment),
  );
}
