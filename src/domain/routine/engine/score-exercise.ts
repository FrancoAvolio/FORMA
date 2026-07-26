import type { CatalogExercise } from "../../exercises/catalog-exercise";
import {
  hasTextMatch,
  normalizeMuscle,
} from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import { EXERCISE_SCORE_WEIGHTS } from "../config/exercise-priorities";
import type { SplitDayTemplate } from "../config/split-templates";
import { deterministicUnitInterval } from "./seed";

export type ExerciseScoringContext = {
  request: RoutineRequest;
  day: SplitDayTemplate;
  desiredPattern?: CatalogExercise["movementPattern"];
  selectionIndex: number;
  selectedExercises: readonly CatalogExercise[];
  usedExerciseIds: ReadonlySet<string>;
  seed: string;
};

function overlapCount(left: readonly string[], right: readonly string[]): number {
  const rightSet = new Set(right.map(normalizeMuscle));
  return left.map(normalizeMuscle).filter((value) => rightSet.has(value)).length;
}

function isPreferred(
  exercise: CatalogExercise,
  request: RoutineRequest,
): boolean {
  return (
    request.preferredExercises.includes(exercise.id) ||
    hasTextMatch(
      [exercise.name, exercise.sourceName ?? "", ...exercise.aliases],
      request.preferredExercises,
    )
  );
}

export function scoreExercise(
  exercise: CatalogExercise,
  context: ExerciseScoringContext,
): number {
  const { request, day, selectedExercises } = context;
  let score = 0;

  if (context.usedExerciseIds.has(exercise.id)) {
    score += EXERCISE_SCORE_WEIGHTS.alreadyUsedPenalty;
  }
  if (selectedExercises.some((selected) => selected.id === exercise.id)) {
    score += EXERCISE_SCORE_WEIGHTS.alreadyUsedPenalty;
  }
  if (
    selectedExercises.some(
      (selected) => selected.substitutionGroup === exercise.substitutionGroup,
    )
  ) {
    score += EXERCISE_SCORE_WEIGHTS.duplicateSubstitutionGroupPenalty;
  }
  if (context.desiredPattern === exercise.movementPattern) {
    score += EXERCISE_SCORE_WEIGHTS.desiredPattern;
  }

  score +=
    overlapCount(exercise.primaryMuscles, day.focus) *
    EXERCISE_SCORE_WEIGHTS.dayPrimaryMuscle;
  score +=
    overlapCount(exercise.secondaryMuscles, day.focus) *
    EXERCISE_SCORE_WEIGHTS.daySecondaryMuscle;
  score +=
    overlapCount(exercise.primaryMuscles, request.focusMuscles) *
    EXERCISE_SCORE_WEIGHTS.requestedPrimaryMuscle;
  score +=
    overlapCount(exercise.secondaryMuscles, request.focusMuscles) *
    EXERCISE_SCORE_WEIGHTS.requestedSecondaryMuscle;

  if (isPreferred(exercise, request)) {
    score += EXERCISE_SCORE_WEIGHTS.preferredExercise;
  }

  if (context.selectionIndex < 3 && exercise.modality === "compound") {
    score += EXERCISE_SCORE_WEIGHTS.earlyCompound;
  }
  if (context.selectionIndex >= 3 && exercise.modality === "isolation") {
    score += EXERCISE_SCORE_WEIGHTS.lateIsolation;
  }
  if (exercise.difficulty === request.experience) {
    score += EXERCISE_SCORE_WEIGHTS.matchingDifficulty;
  }
  if (request.experience === "beginner") {
    if (exercise.skillRequirement === "low") {
      score += EXERCISE_SCORE_WEIGHTS.lowSkillBeginner;
    }
    if (exercise.skillRequirement === "high") {
      score += EXERCISE_SCORE_WEIGHTS.highSkillBeginnerPenalty;
    }
    if (exercise.difficulty === "advanced") {
      score += EXERCISE_SCORE_WEIGHTS.advancedDifficultyBeginnerPenalty;
    }
  }

  if (
    exercise.fatigueCost === "high" &&
    selectedExercises.some((selected) => selected.fatigueCost === "high")
  ) {
    score += EXERCISE_SCORE_WEIGHTS.highFatigueRepeatPenalty;
  }

  // A seeded fractional term makes ties reproducible without hiding material rules.
  score += deterministicUnitInterval(
    context.seed,
    `${day.key}:${context.selectionIndex}:${exercise.id}`,
  );

  return score;
}

export function selectionReasons(
  exercise: CatalogExercise,
  context: Omit<ExerciseScoringContext, "selectedExercises" | "usedExerciseIds">,
): string[] {
  const reasons: string[] = [];
  if (context.desiredPattern === exercise.movementPattern) {
    reasons.push(`Cubre el patrón ${exercise.movementPattern.replaceAll("_", " ")}.`);
  }
  if (overlapCount(exercise.primaryMuscles, context.day.focus) > 0) {
    reasons.push(`Trabaja de forma directa el foco de ${context.day.name.toLowerCase()}.`);
  }
  if (overlapCount(exercise.primaryMuscles, context.request.focusMuscles) > 0) {
    reasons.push("Prioriza uno de los grupos musculares que elegiste.");
  }
  if (isPreferred(exercise, context.request)) {
    reasons.push("Respeta una de tus preferencias de ejercicios.");
  }
  if (context.request.experience === "beginner" && exercise.skillRequirement === "low") {
    reasons.push("Tiene una demanda técnica compatible con un nivel inicial.");
  }
  if (reasons.length === 0) {
    reasons.push("Aporta variedad compatible con el objetivo y el equipamiento disponible.");
  }
  return reasons;
}

