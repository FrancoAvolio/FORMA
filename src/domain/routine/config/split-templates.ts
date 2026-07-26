import type { MovementPattern } from "../../exercises/catalog-exercise";
import type {
  ExperienceLevel,
  RoutineGoal,
} from "../../profile/routine-request";

export type SplitDayTemplate = {
  key: string;
  name: string;
  focus: readonly string[];
  patternSequence: readonly MovementPattern[];
};

export type SplitTemplate = {
  id: string;
  name: string;
  daysPerWeek: number;
  days: readonly SplitDayTemplate[];
  goalAffinity: readonly RoutineGoal[];
  experienceAffinity: readonly ExperienceLevel[];
};

const FULL_BODY_A: SplitDayTemplate = {
  key: "full-body-a",
  name: "Cuerpo completo A",
  focus: ["chest", "back", "quadriceps", "hamstrings", "glutes", "shoulders"],
  patternSequence: [
    "squat",
    "horizontal_push",
    "horizontal_pull",
    "hinge",
    "vertical_push",
    "core",
    "isolation",
    "vertical_pull",
  ],
};

const FULL_BODY_B: SplitDayTemplate = {
  key: "full-body-b",
  name: "Cuerpo completo B",
  focus: ["back", "shoulders", "glutes", "hamstrings", "chest", "quadriceps"],
  patternSequence: [
    "hinge",
    "vertical_push",
    "vertical_pull",
    "lunge",
    "horizontal_push",
    "core",
    "isolation",
    "horizontal_pull",
  ],
};

const FULL_BODY_C: SplitDayTemplate = {
  key: "full-body-c",
  name: "Cuerpo completo C",
  focus: ["quadriceps", "chest", "back", "glutes", "shoulders", "hamstrings"],
  patternSequence: [
    "lunge",
    "horizontal_pull",
    "horizontal_push",
    "squat",
    "vertical_push",
    "core",
    "isolation",
    "vertical_pull",
  ],
};

const PUSH: SplitDayTemplate = {
  key: "push",
  name: "Empuje",
  focus: ["chest", "shoulders", "triceps"],
  patternSequence: [
    "horizontal_push",
    "vertical_push",
    "horizontal_push",
    "vertical_push",
    "isolation",
    "isolation",
    "core",
  ],
};

const PULL: SplitDayTemplate = {
  key: "pull",
  name: "Tracción",
  focus: ["back", "biceps", "rear_delts", "forearms"],
  patternSequence: [
    "vertical_pull",
    "horizontal_pull",
    "isolation",
    "isolation",
    "core",
    "carry",
    "isolation",
    "horizontal_pull",
  ],
};

const LEGS: SplitDayTemplate = {
  key: "legs",
  name: "Piernas",
  focus: ["quadriceps", "hamstrings", "glutes", "calves"],
  patternSequence: [
    "squat",
    "hinge",
    "lunge",
    "squat",
    "isolation",
    "isolation",
    "core",
  ],
};

const UPPER: SplitDayTemplate = {
  key: "upper",
  name: "Tren superior",
  focus: ["chest", "back", "shoulders", "biceps", "triceps"],
  patternSequence: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "horizontal_push",
    "isolation",
    "isolation",
    "horizontal_pull",
  ],
};

const LOWER: SplitDayTemplate = {
  key: "lower",
  name: "Tren inferior",
  focus: ["quadriceps", "hamstrings", "glutes", "calves", "core"],
  patternSequence: [
    "squat",
    "hinge",
    "lunge",
    "squat",
    "hinge",
    "isolation",
    "core",
  ],
};

const TORSO: SplitDayTemplate = {
  key: "torso",
  name: "Torso",
  focus: ["chest", "back", "shoulders"],
  patternSequence: [
    "horizontal_push",
    "horizontal_pull",
    "vertical_push",
    "vertical_pull",
    "horizontal_push",
    "isolation",
    "horizontal_pull",
  ],
};

const LIMBS: SplitDayTemplate = {
  key: "limbs",
  name: "Extremidades",
  focus: ["quadriceps", "hamstrings", "glutes", "biceps", "triceps", "calves"],
  patternSequence: [
    "squat",
    "hinge",
    "lunge",
    "isolation",
    "isolation",
    "isolation",
    "core",
  ],
};

function repeatedDay(day: SplitDayTemplate, suffix: string): SplitDayTemplate {
  return {
    ...day,
    key: `${day.key}-${suffix}`,
    name: `${day.name} ${suffix.toUpperCase()}`,
    patternSequence: [
      ...day.patternSequence.slice(1),
      day.patternSequence[0],
    ] as readonly MovementPattern[],
  };
}

export const SPLIT_TEMPLATES: readonly SplitTemplate[] = [
  {
    id: "full-body-1",
    name: "Cuerpo completo",
    daysPerWeek: 1,
    days: [FULL_BODY_A],
    goalAffinity: ["general_fitness", "muscular_endurance", "hypertrophy", "strength"],
    experienceAffinity: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "full-body-ab",
    name: "Cuerpo completo A/B",
    daysPerWeek: 2,
    days: [FULL_BODY_A, FULL_BODY_B],
    goalAffinity: ["general_fitness", "hypertrophy", "strength", "muscular_endurance"],
    experienceAffinity: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "full-body-abc",
    name: "Cuerpo completo A/B/C",
    daysPerWeek: 3,
    days: [FULL_BODY_A, FULL_BODY_B, FULL_BODY_C],
    goalAffinity: ["general_fitness", "strength", "muscular_endurance", "hypertrophy"],
    experienceAffinity: ["beginner", "intermediate"],
  },
  {
    id: "push-pull-legs",
    name: "Empuje / Tracción / Piernas",
    daysPerWeek: 3,
    days: [PUSH, PULL, LEGS],
    goalAffinity: ["hypertrophy", "strength", "muscular_endurance", "general_fitness"],
    experienceAffinity: ["intermediate", "advanced"],
  },
  {
    id: "upper-lower-4",
    name: "Tren superior / Tren inferior",
    daysPerWeek: 4,
    days: [UPPER, LOWER, repeatedDay(UPPER, "b"), repeatedDay(LOWER, "b")],
    goalAffinity: ["strength", "hypertrophy", "general_fitness", "muscular_endurance"],
    experienceAffinity: ["beginner", "intermediate", "advanced"],
  },
  {
    id: "torso-limbs-4",
    name: "Torso / Extremidades",
    daysPerWeek: 4,
    days: [TORSO, LIMBS, repeatedDay(TORSO, "b"), repeatedDay(LIMBS, "b")],
    goalAffinity: ["hypertrophy", "muscular_endurance", "general_fitness", "strength"],
    experienceAffinity: ["intermediate", "advanced"],
  },
  {
    id: "upper-lower-ppl-5",
    name: "Superior / Inferior / Empuje / Tracción / Piernas",
    daysPerWeek: 5,
    days: [UPPER, LOWER, PUSH, PULL, LEGS],
    goalAffinity: ["hypertrophy", "strength", "muscular_endurance", "general_fitness"],
    experienceAffinity: ["intermediate", "advanced"],
  },
  {
    id: "ppl-6",
    name: "Empuje / Tracción / Piernas × 2",
    daysPerWeek: 6,
    days: [
      PUSH,
      PULL,
      LEGS,
      repeatedDay(PUSH, "b"),
      repeatedDay(PULL, "b"),
      repeatedDay(LEGS, "b"),
    ],
    goalAffinity: ["hypertrophy", "strength", "muscular_endurance", "general_fitness"],
    experienceAffinity: ["intermediate", "advanced"],
  },
];

export function getSplitTemplate(splitId: string): SplitTemplate | undefined {
  return SPLIT_TEMPLATES.find((template) => template.id === splitId);
}
