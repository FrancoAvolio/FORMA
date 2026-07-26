import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import {
  SPLIT_TEMPLATES,
  type SplitTemplate,
} from "../config/split-templates";

function templateScore(
  template: SplitTemplate,
  request: RoutineRequest,
): number {
  let score = 0;
  const goalRank = template.goalAffinity.indexOf(request.goal);
  const experienceRank = template.experienceAffinity.indexOf(request.experience);

  score += goalRank < 0 ? -50 : 30 - goalRank * 5;
  score += experienceRank < 0 ? -50 : 20 - experienceRank * 4;

  if (request.daysPerWeek === 3) {
    if (request.experience === "beginner" && template.id === "full-body-abc") {
      score += 30;
    }
    if (
      request.experience !== "beginner" &&
      request.goal === "hypertrophy" &&
      template.id === "push-pull-legs"
    ) {
      score += 22;
    }
    if (request.sessionMinutes <= 40 && template.id === "push-pull-legs") {
      score += 8;
    }
  }

  if (request.daysPerWeek === 4) {
    const focus = new Set(request.focusMuscles.map(normalizeMuscle));
    const prioritizesLimbs = ["biceps", "triceps", "quadriceps", "hamstrings"].some(
      (muscle) => focus.has(muscle),
    );
    if (prioritizesLimbs && template.id === "torso-limbs-4") {
      score += 18;
    }
    if (!prioritizesLimbs && template.id === "upper-lower-4") {
      score += 12;
    }
    if (request.experience === "beginner" && template.id === "upper-lower-4") {
      score += 20;
    }
  }

  const usablePatterns = 11 - request.excludedMovementPatterns.length;
  if (usablePatterns <= 4 && template.days.some((day) => day.focus.length >= 5)) {
    score -= 8;
  }

  if (request.availableEquipment.length <= 2 && template.id.startsWith("full-body")) {
    score += 4;
  }

  return score;
}

export function chooseSplit(request: RoutineRequest): SplitTemplate {
  const candidates = SPLIT_TEMPLATES.filter(
    (template) => template.daysPerWeek === request.daysPerWeek,
  );

  if (candidates.length === 0) {
    throw new Error(`No split template supports ${request.daysPerWeek} days.`);
  }

  return [...candidates].sort((left, right) => {
    const scoreDifference = templateScore(right, request) - templateScore(left, request);
    return scoreDifference || left.id.localeCompare(right.id, "en");
  })[0];
}

