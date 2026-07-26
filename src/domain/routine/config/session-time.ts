export const SESSION_TIME_RULES = {
  warmupMinutes: 6,
  transitionSeconds: 75,
  repetitionSeconds: 4,
  unilateralRepetitionMultiplier: 1.45,
  minimumExerciseCount: 3,
  maximumExerciseCount: 8,
  // Session time represents the user's available ceiling, not a requirement to fill every minute.
  lowerToleranceRatio: 0.45,
  upperToleranceMinutes: 6,
} as const;

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
