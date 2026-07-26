import type {
  CatalogExercise,
  MovementPattern,
} from "../../exercises/catalog-exercise";
import type { RoutineRequest } from "../../profile/routine-request";
import type { SafetyScreening } from "../../safety/schemas";

const PATTERNS: readonly MovementPattern[] = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "carry",
  "core",
  "isolation",
  "cardio",
];

const PRIMARY_MUSCLES: Readonly<Record<MovementPattern, readonly string[]>> = {
  horizontal_push: ["chest"],
  vertical_push: ["shoulders"],
  horizontal_pull: ["back"],
  vertical_pull: ["back"],
  squat: ["quadriceps"],
  hinge: ["hamstrings"],
  lunge: ["glutes"],
  carry: ["forearms"],
  core: ["core"],
  isolation: ["biceps", "triceps", "calves", "shoulders", "quadriceps", "hamstrings"],
  cardio: ["core"],
};

const SECONDARY_MUSCLES: Readonly<Record<MovementPattern, readonly string[]>> = {
  horizontal_push: ["triceps", "shoulders"],
  vertical_push: ["triceps"],
  horizontal_pull: ["biceps"],
  vertical_pull: ["biceps"],
  squat: ["glutes"],
  hinge: ["glutes", "back"],
  lunge: ["quadriceps"],
  carry: ["core"],
  core: [],
  isolation: [],
  cardio: [],
};

export function createCatalog(
  variantsPerPattern = 14,
  equipment = "body_weight",
): CatalogExercise[] {
  return PATTERNS.flatMap((pattern) =>
    Array.from({ length: variantsPerPattern }, (_, index) => {
      const primaryOptions = PRIMARY_MUSCLES[pattern];
      const primaryMuscle = primaryOptions[index % primaryOptions.length] ?? "core";
      return {
        id: `${pattern}-${index.toString().padStart(2, "0")}`,
        name: `${pattern.replaceAll("_", " ")} ${index}`,
        sourceName: `${pattern} source ${index}`,
        aliases: [`alias ${pattern} ${index}`],
        bodyPart: ["quadriceps", "hamstrings", "glutes", "calves"].includes(primaryMuscle)
          ? "lower_body"
          : "upper_body",
        equipment: [equipment],
        primaryMuscles: [primaryMuscle],
        secondaryMuscles: [...SECONDARY_MUSCLES[pattern]],
        movementPattern: pattern,
        modality:
          pattern === "isolation" || pattern === "core" || pattern === "cardio"
            ? "isolation"
            : "compound",
        laterality: index % 4 === 0 ? "unilateral" : "bilateral",
        difficulty: index % 5 === 0 ? "intermediate" : "beginner",
        fatigueCost: index % 6 === 0 ? "high" : "medium",
        skillRequirement: index % 7 === 0 ? "medium" : "low",
        defaultRepRange: [3, 20],
        defaultRestSeconds: [30, 240],
        substitutionGroup: `${pattern}-${Math.floor(index / 2)}`,
        tags: [pattern, primaryMuscle],
        approvedForGeneration: true,
      } satisfies CatalogExercise;
    }),
  );
}

export function createRoutineRequest(
  overrides: Partial<RoutineRequest> = {},
): RoutineRequest {
  return {
    goal: "hypertrophy",
    experience: "intermediate",
    daysPerWeek: 4,
    sessionMinutes: 60,
    trainingLocation: "home",
    availableEquipment: ["body_weight"],
    focusMuscles: [],
    excludedExercises: [],
    excludedMovementPatterns: [],
    preferredExercises: [],
    limitations: [],
    notes: null,
    ...overrides,
  };
}

export const CLEAR_SAFETY_SCREENING: SafetyScreening = {
  confirmedCurrentStatus: true,
  painDuringMovement: false,
  recentInjury: false,
  recentOperation: false,
  medicalRestriction: false,
  symptomsDuringExercise: false,
  professionalInstructionsAffectTraining: false,
};

