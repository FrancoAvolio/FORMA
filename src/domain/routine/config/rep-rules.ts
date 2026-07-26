import type { ExerciseModality } from "../../exercises/catalog-exercise";
import type {
  ExperienceLevel,
  RoutineGoal,
} from "../../profile/routine-request";

export type PrescriptionRule = {
  repetitions: readonly [number, number];
  sets: Readonly<Record<ExperienceLevel, number>>;
  restSeconds: readonly [number, number];
  rir: Readonly<Record<ExperienceLevel, number>>;
};

type GoalPrescriptionRules = Readonly<Record<ExerciseModality, PrescriptionRule>>;

export const REP_RULES: Readonly<Record<RoutineGoal, GoalPrescriptionRules>> = {
  hypertrophy: {
    compound: {
      repetitions: [6, 10],
      sets: { beginner: 2, intermediate: 3, advanced: 4 },
      restSeconds: [90, 150],
      rir: { beginner: 3, intermediate: 2, advanced: 2 },
    },
    isolation: {
      repetitions: [10, 15],
      sets: { beginner: 2, intermediate: 3, advanced: 3 },
      restSeconds: [60, 105],
      rir: { beginner: 3, intermediate: 2, advanced: 1 },
    },
  },
  strength: {
    compound: {
      repetitions: [3, 6],
      sets: { beginner: 3, intermediate: 4, advanced: 4 },
      restSeconds: [150, 240],
      rir: { beginner: 3, intermediate: 2, advanced: 2 },
    },
    isolation: {
      repetitions: [8, 12],
      sets: { beginner: 2, intermediate: 3, advanced: 3 },
      restSeconds: [75, 120],
      rir: { beginner: 3, intermediate: 2, advanced: 2 },
    },
  },
  general_fitness: {
    compound: {
      repetitions: [8, 12],
      sets: { beginner: 2, intermediate: 3, advanced: 3 },
      restSeconds: [75, 120],
      rir: { beginner: 3, intermediate: 3, advanced: 2 },
    },
    isolation: {
      repetitions: [10, 15],
      sets: { beginner: 2, intermediate: 2, advanced: 3 },
      restSeconds: [45, 90],
      rir: { beginner: 3, intermediate: 3, advanced: 2 },
    },
  },
  muscular_endurance: {
    compound: {
      repetitions: [12, 18],
      sets: { beginner: 2, intermediate: 3, advanced: 3 },
      restSeconds: [45, 90],
      rir: { beginner: 3, intermediate: 2, advanced: 2 },
    },
    isolation: {
      repetitions: [15, 20],
      sets: { beginner: 2, intermediate: 3, advanced: 3 },
      restSeconds: [30, 75],
      rir: { beginner: 3, intermediate: 2, advanced: 2 },
    },
  },
};

export const SET_LIMITS = {
  minimum: 1,
  maximum: 6,
} as const;

export const REST_LIMITS_SECONDS = {
  minimum: 30,
  maximum: 300,
} as const;
