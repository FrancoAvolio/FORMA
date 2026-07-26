export const EXERCISE_SCORE_WEIGHTS = {
  desiredPattern: 50,
  dayPrimaryMuscle: 28,
  daySecondaryMuscle: 12,
  requestedPrimaryMuscle: 20,
  requestedSecondaryMuscle: 8,
  preferredExercise: 35,
  earlyCompound: 14,
  lateIsolation: 8,
  matchingDifficulty: 8,
  lowSkillBeginner: 10,
  highSkillBeginnerPenalty: -24,
  advancedDifficultyBeginnerPenalty: -18,
  highFatigueRepeatPenalty: -18,
  duplicateSubstitutionGroupPenalty: -45,
  alreadyUsedPenalty: -10_000,
} as const;

