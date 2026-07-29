import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutineRequest } from "../../profile/routine-request";
import {
  SESSION_TIME_RULES,
  sessionTimeBounds,
} from "../config/session-time";
import { REP_RULES, REST_LIMITS_SECONDS } from "../config/rep-rules";
import type { SplitTemplate } from "../config/split-templates";
import { WEEKLY_VOLUME_RULES } from "../config/volume-rules";
import type {
  RoutineDay,
  RoutineExercise,
  RoutinePlan,
} from "../schemas";
import { assignPrescription } from "./assign-prescription";
import { buildCandidatePool } from "./build-candidate-pool";
import {
  buildSessionBlocks,
  expandSessionBlocksToTarget,
} from "./build-session-blocks";
import { calculateWeeklyVolume } from "./calculate-weekly-volume";
import {
  estimateExerciseWorkSeconds,
  estimateSessionDuration,
} from "./estimate-session-duration";
import { scoreExercise, selectionReasons } from "./score-exercise";

export type FitRoutineSessionDurationsInput = {
  plan: RoutinePlan;
  request: RoutineRequest;
  catalog: readonly CatalogExercise[];
  split: SplitTemplate;
  mutableDayIndexes?: ReadonlySet<number>;
};

type FitAction = {
  kind: "rest" | "set" | "exercise";
  plan: RoutinePlan;
  dayIndex: number;
  exactWorkSeconds: number;
  tieBreaker: string;
};

function maximumRestSeconds(
  exercise: CatalogExercise,
  request: RoutineRequest,
): number {
  const preferred = REP_RULES[request.goal][exercise.modality].restSeconds;
  const minimum = Math.max(preferred[0], exercise.defaultRestSeconds[0]);
  const maximum = Math.min(preferred[1], exercise.defaultRestSeconds[1]);
  const configuredMaximum = minimum <= maximum ? maximum : preferred[1];
  return Math.min(
    REST_LIMITS_SECONDS.maximum,
    Math.max(REST_LIMITS_SECONDS.minimum, configuredMaximum),
  );
}

function withDay(
  plan: RoutinePlan,
  dayIndex: number,
  exercises: readonly RoutineExercise[],
  catalog: readonly CatalogExercise[],
): RoutinePlan {
  return {
    ...plan,
    days: plan.days.map((day, index) => {
      if (index !== dayIndex) return day;
      const sessionBlocks =
        (day.sessionBlocks?.length ?? 0) > 0 ? day.sessionBlocks : [];
      return {
        ...day,
        exercises: [...exercises],
        estimatedMinutes: estimateSessionDuration(
          exercises,
          catalog,
          sessionBlocks,
        ),
      };
    }),
  };
}

function withinVolumeLimits(
  plan: RoutinePlan,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
): boolean {
  const maximum =
    WEEKLY_VOLUME_RULES[request.goal][request.experience].maximumSets;
  return Object.values(calculateWeeklyVolume(plan, catalog)).every(
    (volume) => volume.totalSets <= maximum,
  );
}

function hasBalancedPushPull(
  plan: RoutinePlan,
  catalogById: ReadonlyMap<string, CatalogExercise>,
): boolean {
  let pushes = 0;
  let pulls = 0;
  for (const day of plan.days) {
    for (const prescribed of day.exercises) {
      const pattern = catalogById.get(prescribed.exerciseId)?.movementPattern;
      if (pattern === "horizontal_push" || pattern === "vertical_push") {
        pushes += 1;
      } else if (
        pattern === "horizontal_pull" ||
        pattern === "vertical_pull"
      ) {
        pulls += 1;
      }
    }
  }
  if (pushes + pulls < 3) return true;
  if (pushes === 0 || pulls === 0) return false;
  return Math.max(pushes, pulls) / Math.min(pushes, pulls) <= 2.5;
}

function normalizeDays(
  plan: RoutinePlan,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  mutableDayIndexes: ReadonlySet<number>,
): RoutinePlan {
  return {
    ...plan,
    days: plan.days.map((day, dayIndex) => {
      if (!mutableDayIndexes.has(dayIndex)) return day;
      const sessionBlocks =
        (day.sessionBlocks?.length ?? 0) > 0
          ? day.sessionBlocks
          : buildSessionBlocks(request.sessionMinutes, day.exercises);
      return {
        ...day,
        sessionBlocks,
        estimatedMinutes: estimateSessionDuration(
          day.exercises,
          catalog,
          sessionBlocks,
        ),
      };
    }),
  };
}

function actionForRest(
  plan: RoutinePlan,
  dayIndex: number,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  catalogById: ReadonlyMap<string, CatalogExercise>,
): FitAction[] {
  const day = plan.days[dayIndex];
  if (!day) return [];
  const upper = sessionTimeBounds(request.sessionMinutes).upper;

  return day.exercises.flatMap((prescribed, exerciseIndex) => {
    const exercise = catalogById.get(prescribed.exerciseId);
    if (!exercise) return [];
    const maximum = maximumRestSeconds(exercise, request);
    if (prescribed.restSeconds >= maximum) return [];
    const nextRest = Math.min(
      maximum,
      prescribed.restSeconds + SESSION_TIME_RULES.restAdjustmentSeconds,
    );
    const exercises = day.exercises.map((candidate, index) =>
      index === exerciseIndex
        ? { ...candidate, restSeconds: nextRest }
        : candidate,
    );
    const candidatePlan = withDay(plan, dayIndex, exercises, catalog);
    const candidateDay = candidatePlan.days[dayIndex];
    if (!candidateDay || candidateDay.estimatedMinutes > upper) return [];
    return [
      {
        kind: "rest" as const,
        plan: candidatePlan,
        dayIndex,
        exactWorkSeconds: estimateExerciseWorkSeconds(exercises, catalog),
        tieBreaker: `${exerciseIndex.toString().padStart(2, "0")}:${exercise.id}`,
      },
    ];
  });
}

function actionForSet(
  plan: RoutinePlan,
  dayIndex: number,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  catalogById: ReadonlyMap<string, CatalogExercise>,
): FitAction[] {
  const day = plan.days[dayIndex];
  if (!day) return [];
  const upper = sessionTimeBounds(request.sessionMinutes).upper;

  return day.exercises.flatMap((prescribed, exerciseIndex) => {
    const exercise = catalogById.get(prescribed.exerciseId);
    if (!exercise) return [];
    const prescription = assignPrescription(exercise, request, {
      isPrimaryForDay:
        exerciseIndex < 2 ||
        exercise.primaryMuscles
          .map(normalizeMuscle)
          .some((muscle) =>
            request.focusMuscles.map(normalizeMuscle).includes(muscle),
          ),
      isPriorityMuscle: exercise.primaryMuscles
        .map(normalizeMuscle)
        .some((muscle) =>
          request.focusMuscles.map(normalizeMuscle).includes(muscle),
        ),
    });
    if (prescribed.sets >= prescription.sets) return [];
    const exercises = day.exercises.map((candidate, index) =>
      index === exerciseIndex
        ? { ...candidate, sets: candidate.sets + 1 }
        : candidate,
    );
    const candidatePlan = withDay(plan, dayIndex, exercises, catalog);
    const candidateDay = candidatePlan.days[dayIndex];
    if (
      !candidateDay ||
      candidateDay.estimatedMinutes > upper ||
      !withinVolumeLimits(candidatePlan, request, catalog)
    ) {
      return [];
    }
    return [
      {
        kind: "set" as const,
        plan: candidatePlan,
        dayIndex,
        exactWorkSeconds: estimateExerciseWorkSeconds(exercises, catalog),
        tieBreaker: `${exerciseIndex.toString().padStart(2, "0")}:${exercise.id}`,
      },
    ];
  });
}

function actionForExercise(
  plan: RoutinePlan,
  dayIndex: number,
  request: RoutineRequest,
  catalog: readonly CatalogExercise[],
  catalogById: ReadonlyMap<string, CatalogExercise>,
  split: SplitTemplate,
): FitAction[] {
  const day = plan.days[dayIndex];
  const dayTemplate = split.days[dayIndex];
  if (
    !day ||
    !dayTemplate ||
    day.exercises.length >= SESSION_TIME_RULES.maximumExerciseCount
  ) {
    return [];
  }
  const upper = sessionTimeBounds(request.sessionMinutes).upper;
  const candidatePool = buildCandidatePool(catalog, request);
  const usedExerciseIds = new Set(
    plan.days.flatMap((routineDay) =>
      routineDay.exercises.map((exercise) => exercise.exerciseId),
    ),
  );
  const usedGroups = new Set(
    day.exercises.flatMap((prescribed) => {
      const exercise = catalogById.get(prescribed.exerciseId);
      return exercise ? [exercise.substitutionGroup] : [];
    }),
  );
  const allowedPatterns = new Set(dayTemplate.patternSequence);
  const selectedExercises = day.exercises.flatMap((prescribed) => {
    const exercise = catalogById.get(prescribed.exerciseId);
    return exercise ? [exercise] : [];
  });
  const desiredPattern =
    dayTemplate.patternSequence[
      day.exercises.length % dayTemplate.patternSequence.length
    ];

  return candidatePool
    .filter(
      (exercise) =>
        !usedExerciseIds.has(exercise.id) &&
        !usedGroups.has(exercise.substitutionGroup) &&
        allowedPatterns.has(exercise.movementPattern),
    )
    .flatMap((exercise) => {
      const assigned = assignPrescription(exercise, request, {
        isPrimaryForDay: false,
        isPriorityMuscle: exercise.primaryMuscles
          .map(normalizeMuscle)
          .some((muscle) =>
            request.focusMuscles.map(normalizeMuscle).includes(muscle),
          ),
      });
      const prescribed: RoutineExercise = {
        exerciseId: exercise.id,
        ...assigned,
        sets: Math.min(
          assigned.sets,
          exercise.modality === "compound" ? 2 : 1,
        ),
        restSeconds: maximumRestSeconds(exercise, request),
        selectionReasons: selectionReasons(exercise, {
          request,
          day: dayTemplate,
          desiredPattern,
          selectionIndex: day.exercises.length,
          seed: `${plan.seed}:duration-fit:${dayIndex}`,
        }),
      };
      const exercises = [...day.exercises, prescribed];
      const candidatePlan = withDay(plan, dayIndex, exercises, catalog);
      const candidateDay = candidatePlan.days[dayIndex];
      if (
        !candidateDay ||
        candidateDay.estimatedMinutes > upper ||
        !withinVolumeLimits(candidatePlan, request, catalog) ||
        !hasBalancedPushPull(candidatePlan, catalogById)
      ) {
        return [];
      }
      const score = scoreExercise(exercise, {
        request,
        day: dayTemplate,
        desiredPattern,
        selectionIndex: day.exercises.length,
        selectedExercises,
        usedExerciseIds,
        seed: `${plan.seed}:duration-fit:${dayIndex}`,
      });
      return [
        {
          kind: "exercise" as const,
          plan: candidatePlan,
          dayIndex,
          exactWorkSeconds: estimateExerciseWorkSeconds(exercises, catalog),
          tieBreaker: `${(-score).toString().padStart(8, "0")}:${exercise.id}`,
        },
      ];
    });
}

function chooseAction(actions: readonly FitAction[]): FitAction | undefined {
  return [...actions].sort(
    (left, right) =>
      right.exactWorkSeconds - left.exactWorkSeconds ||
      left.tieBreaker.localeCompare(right.tieBreaker, "en"),
  )[0];
}

/**
 * Fills short sessions without weakening volume, equipment or exclusion
 * constraints. Recovery is expanded first, then existing prescriptions, and
 * only then is compatible low-volume work added.
 */
export function fitRoutineSessionDurations(
  input: FitRoutineSessionDurationsInput,
): RoutinePlan {
  const bounds = sessionTimeBounds(input.request.sessionMinutes);
  const catalogById = new Map(
    input.catalog.map((exercise) => [exercise.id, exercise]),
  );
  const mutableDayIndexes =
    input.mutableDayIndexes ??
    new Set(input.plan.days.map((_, index) => index));
  const blocked = new Set<number>();
  let fitted = normalizeDays(
    input.plan,
    input.request,
    input.catalog,
    mutableDayIndexes,
  );

  for (
    let iteration = 0;
    iteration < SESSION_TIME_RULES.maximumFitIterations;
    iteration += 1
  ) {
    const target = fitted.days
      .map((day, dayIndex) => ({ dayIndex, minutes: day.estimatedMinutes }))
      .filter(
        ({ dayIndex, minutes }) =>
          mutableDayIndexes.has(dayIndex) &&
          !blocked.has(dayIndex) &&
          minutes < bounds.lower,
      )
      .sort(
        (left, right) =>
          left.minutes - right.minutes || left.dayIndex - right.dayIndex,
      )[0];
    if (!target) break;

    const rest = chooseAction(
      actionForRest(
        fitted,
        target.dayIndex,
        input.request,
        input.catalog,
        catalogById,
      ),
    );
    if (rest) {
      fitted = rest.plan;
      continue;
    }

    const set = chooseAction(
      actionForSet(
        fitted,
        target.dayIndex,
        input.request,
        input.catalog,
        catalogById,
      ),
    );
    if (set) {
      fitted = set.plan;
      continue;
    }

    const exercise = chooseAction(
      actionForExercise(
        fitted,
        target.dayIndex,
        input.request,
        input.catalog,
        catalogById,
        input.split,
      ),
    );
    if (exercise) {
      fitted = exercise.plan;
      continue;
    }

    blocked.add(target.dayIndex);
  }

  fitted = {
    ...fitted,
    days: fitted.days.map((day, dayIndex) => {
      if (
        !mutableDayIndexes.has(dayIndex) ||
        day.estimatedMinutes >= bounds.target
      ) {
        return day;
      }
      const sessionBlocks = expandSessionBlocksToTarget(
        day.sessionBlocks ??
          buildSessionBlocks(input.request.sessionMinutes, day.exercises),
        bounds.target - day.estimatedMinutes,
      );
      return {
        ...day,
        sessionBlocks,
        estimatedMinutes: estimateSessionDuration(
          day.exercises,
          input.catalog,
          sessionBlocks,
        ),
      };
    }),
  };

  return fitted;
}

export function recalculateRoutineDayDuration(
  day: RoutineDay,
  catalog: readonly CatalogExercise[],
): RoutineDay {
  return {
    ...day,
    estimatedMinutes: estimateSessionDuration(
      day.exercises,
      catalog,
      day.sessionBlocks ?? [],
    ),
  };
}
