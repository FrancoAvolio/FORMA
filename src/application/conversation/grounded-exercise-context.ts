import "server-only";

import {
  EXERCISE_DATASET_COMMIT,
  getExerciseSummaryById,
} from "@/data/catalog";
import { getExerciseDetailById } from "@/data/details";
import { getRoutineCatalog } from "@/data/routine-catalog";
import type { ExerciseDetail } from "@/data/types";
import type { CatalogExercise } from "@/domain/exercises";
import {
  normalizeEquipment,
  normalizeMuscle,
} from "@/domain/exercises/normalization";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "@/domain/profile/routine-request";
import { findSubstitutions } from "@/domain/routine/engine/find-substitutions";
import {
  RoutinePlanSchema,
  type RoutineExercise,
  type RoutinePlan,
} from "@/domain/routine/schemas";

export const GROUNDED_EXERCISE_CONTEXT_LIMITS = {
  alternatives: 5,
  alternativeReasons: 5,
  instructionCharacters: 2_000,
  instructionStepCharacters: 600,
  instructionSteps: 8,
  metadataCharacters: 240,
  primaryMuscles: 12,
  secondaryMuscles: 12,
  tags: 12,
} as const;

export type GroundedExerciseQuestionKind =
  | "overview"
  | "muscles"
  | "instructions"
  | "selection_reason"
  | "alternatives";

/** `exerciseIndex` is zero-based and is resolved only inside the supplied plan. */
export type GroundedExerciseTarget =
  | {
      exerciseId: string;
      dayId?: string;
    }
  | {
      dayId: string;
      exerciseIndex: number;
    };

type GroundedExerciseContextBaseInput = {
  target: GroundedExerciseTarget;
  routinePlan: RoutinePlan | null;
};

export type GroundedExerciseContextInput =
  | (GroundedExerciseContextBaseInput & {
      questionKind: Exclude<GroundedExerciseQuestionKind, "alternatives">;
    })
  | (GroundedExerciseContextBaseInput & {
      questionKind: "alternatives";
      routineRequest: RoutineRequest;
      alternativesLimit?: number;
      /** Canonical equipment tokens requested for the alternatives, for example `cable`. */
      requiredAlternativeEquipment?: readonly string[];
    });

export type GroundedExerciseFacts = {
  id: string;
  displayName: string;
  displayNameEs: string | null;
  sourceName: string;
  bodyPart: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  requiredEquipment: string[];
  instructionsEs: string;
  instructionStepsEs: string[];
  reviewStatus: ExerciseDetail["reviewStatus"];
  approvedForGeneration: boolean;
  difficulty: ExerciseDetail["difficulty"];
  movementPattern: ExerciseDetail["movementPattern"];
  modality: ExerciseDetail["modality"];
  laterality: ExerciseDetail["laterality"];
  substitutionGroup: string | null;
  tags: string[];
  media: {
    available: boolean;
    hasThumbnail: boolean;
    hasAnimation: boolean;
    mediaRef: string | null;
    attribution: string | null;
  };
  sourceAttribution: string;
};

export type GroundedRoutineExerciseContext = {
  planId: string;
  dayId: string;
  dayName: string;
  exerciseIndex: number;
  prescription: Pick<
    RoutineExercise,
    "sets" | "repPrescription" | "restSeconds" | "rir" | "tempo" | "notes"
  >;
  /** Reasons already produced by deterministic application/domain logic for this plan. */
  selectionReasons: string[];
};

export type GroundedExerciseAlternative = {
  id: string;
  displayName: string;
  displayNameEs: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  requiredEquipment: string[];
  difficulty: ExerciseDetail["difficulty"];
  movementPattern: ExerciseDetail["movementPattern"];
  modality: ExerciseDetail["modality"];
  substitutionGroup: string;
  mediaAvailable: boolean;
  /** Deterministic facts explaining why this approved candidate is compatible. */
  compatibilityReasons: string[];
};

export type GroundedExerciseContext = {
  questionKind: GroundedExerciseQuestionKind;
  exercise: GroundedExerciseFacts;
  routine: GroundedRoutineExerciseContext | null;
  alternatives: GroundedExerciseAlternative[];
  alternativeConstraints: {
    requiredEquipment: string[];
  } | null;
  grounding: {
    source: "validated_local_catalog";
    datasetCommit: string;
    routineContextSource: "current_routine_plan" | null;
  };
};

export type GroundedExerciseContextErrorCode =
  | "INVALID_ROUTINE_CONTEXT"
  | "INVALID_REQUEST_CONTEXT"
  | "DAY_NOT_FOUND"
  | "EXERCISE_POSITION_NOT_FOUND"
  | "EXERCISE_NOT_FOUND"
  | "EXERCISE_NOT_IN_ROUTINE"
  | "EXERCISE_NOT_APPROVED";

export type GroundedExerciseContextResult =
  | {
      ok: true;
      context: GroundedExerciseContext;
    }
  | {
      ok: false;
      code: GroundedExerciseContextErrorCode;
      message: string;
    };

type RoutineOccurrence = {
  dayId: string;
  dayName: string;
  exerciseIndex: number;
  prescribed: RoutineExercise;
};

const routineCatalog = getRoutineCatalog();
const routineExerciseById = new Map(
  routineCatalog.map((exercise) => [exercise.id, exercise]),
);

function boundedText(value: string, maximumCharacters: number): string {
  if (value.length <= maximumCharacters) {
    return value;
  }
  return value.slice(0, maximumCharacters).trimEnd();
}

function boundedList(
  values: readonly string[],
  maximumItems: number,
  maximumCharacters = GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
): string[] {
  return values
    .slice(0, maximumItems)
    .map((value) => boundedText(value, maximumCharacters));
}

function validateRoutineContext(
  plan: RoutinePlan | null,
):
  | { ok: true; plan: RoutinePlan | null }
  | { ok: false; result: GroundedExerciseContextResult } {
  if (plan === null) {
    return { ok: true, plan: null };
  }

  const parsed = RoutinePlanSchema.safeParse(plan);
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "INVALID_ROUTINE_CONTEXT",
        message: "La rutina actual no tiene una estructura válida.",
      },
    };
  }

  const everyExerciseIsGrounded = parsed.data.days
    .flatMap((day) => day.exercises)
    .every(
      ({ exerciseId }) =>
        routineExerciseById.has(exerciseId) &&
        getExerciseDetailById(exerciseId)?.approvedForGeneration === true,
    );

  if (!everyExerciseIsGrounded) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "INVALID_ROUTINE_CONTEXT",
        message:
          "La rutina actual contiene un ejercicio que no pertenece al catálogo aprobado.",
      },
    };
  }

  return { ok: true, plan: parsed.data };
}

function occurrenceInPlan(
  plan: RoutinePlan | null,
  exerciseId: string,
  dayId?: string,
): RoutineOccurrence | null {
  if (!plan) {
    return null;
  }

  const days = dayId ? plan.days.filter((day) => day.id === dayId) : plan.days;
  for (const day of days) {
    const exerciseIndex = day.exercises.findIndex(
      (exercise) => exercise.exerciseId === exerciseId,
    );
    if (exerciseIndex >= 0) {
      const prescribed = day.exercises[exerciseIndex];
      if (prescribed) {
        return {
          dayId: day.id,
          dayName: day.name,
          exerciseIndex,
          prescribed,
        };
      }
    }
  }
  return null;
}

function resolveTarget(
  target: GroundedExerciseTarget,
  plan: RoutinePlan | null,
):
  | {
      ok: true;
      exerciseId: string;
      occurrence: RoutineOccurrence | null;
    }
  | { ok: false; result: GroundedExerciseContextResult } {
  if ("exerciseId" in target) {
    const exerciseId = target.exerciseId.trim();
    if (!getExerciseSummaryById(exerciseId) || !getExerciseDetailById(exerciseId)) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "EXERCISE_NOT_FOUND",
          message: "El ejercicio indicado no existe en el catálogo local validado.",
        },
      };
    }

    if (target.dayId && !plan?.days.some((day) => day.id === target.dayId)) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "DAY_NOT_FOUND",
          message: "No se encontró el día indicado en la rutina actual.",
        },
      };
    }

    const occurrence = occurrenceInPlan(plan, exerciseId, target.dayId);
    if (target.dayId && !occurrence) {
      return {
        ok: false,
        result: {
          ok: false,
          code: "EXERCISE_NOT_IN_ROUTINE",
          message: "Ese ejercicio no forma parte del día indicado.",
        },
      };
    }
    return { ok: true, exerciseId, occurrence };
  }

  const day = plan?.days.find((candidate) => candidate.id === target.dayId);
  if (!day) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "DAY_NOT_FOUND",
        message: "No se encontró el día indicado en la rutina actual.",
      },
    };
  }
  if (!Number.isInteger(target.exerciseIndex) || target.exerciseIndex < 0) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "EXERCISE_POSITION_NOT_FOUND",
        message: "La posición del ejercicio no existe en el día indicado.",
      },
    };
  }

  const prescribed = day.exercises[target.exerciseIndex];
  if (!prescribed) {
    return {
      ok: false,
      result: {
        ok: false,
        code: "EXERCISE_POSITION_NOT_FOUND",
        message: "La posición del ejercicio no existe en el día indicado.",
      },
    };
  }

  return {
    ok: true,
    exerciseId: prescribed.exerciseId,
    occurrence: {
      dayId: day.id,
      dayName: day.name,
      exerciseIndex: target.exerciseIndex,
      prescribed,
    },
  };
}

function exerciseFacts(
  detail: ExerciseDetail,
  curated: CatalogExercise | undefined,
): GroundedExerciseFacts {
  return {
    id: detail.id,
    displayName: boundedText(
      detail.displayName,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
    ),
    displayNameEs: detail.displayNameEs
      ? boundedText(
          detail.displayNameEs,
          GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
        )
      : null,
    sourceName: boundedText(
      detail.sourceName,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
    ),
    bodyPart: boundedText(
      detail.bodyPart,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
    ),
    primaryMuscles: boundedList(
      detail.primaryMuscles,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.primaryMuscles,
    ),
    secondaryMuscles: boundedList(
      detail.secondaryMuscles,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.secondaryMuscles,
    ),
    requiredEquipment: boundedList(detail.requiredEquipment, 8),
    instructionsEs: boundedText(
      detail.instructionsEs,
      GROUNDED_EXERCISE_CONTEXT_LIMITS.instructionCharacters,
    ),
    instructionStepsEs: detail.instructionStepsEs
      .slice(0, GROUNDED_EXERCISE_CONTEXT_LIMITS.instructionSteps)
      .map((step) =>
        boundedText(
          step,
          GROUNDED_EXERCISE_CONTEXT_LIMITS.instructionStepCharacters,
        ),
      ),
    reviewStatus: detail.reviewStatus,
    approvedForGeneration: detail.approvedForGeneration,
    difficulty: detail.difficulty,
    movementPattern: detail.movementPattern,
    modality: detail.modality,
    laterality: detail.laterality,
    substitutionGroup: curated?.substitutionGroup ?? null,
    tags: curated
      ? boundedList(curated.tags, GROUNDED_EXERCISE_CONTEXT_LIMITS.tags)
      : [],
    media: {
      available: detail.mediaAvailable,
      hasThumbnail: detail.hasThumbnail,
      hasAnimation: detail.hasAnimation,
      mediaRef: detail.mediaRef,
      attribution: detail.sourceMedia?.attribution ?? null,
    },
    sourceAttribution: boundedText(detail.sourceAttribution, 500),
  };
}

function routineContext(
  plan: RoutinePlan,
  occurrence: RoutineOccurrence,
): GroundedRoutineExerciseContext {
  return {
    planId: plan.id,
    dayId: occurrence.dayId,
    dayName: occurrence.dayName,
    exerciseIndex: occurrence.exerciseIndex,
    prescription: {
      sets: occurrence.prescribed.sets,
      repPrescription: occurrence.prescribed.repPrescription,
      restSeconds: occurrence.prescribed.restSeconds,
      rir: occurrence.prescribed.rir,
      tempo: occurrence.prescribed.tempo,
      notes: [...occurrence.prescribed.notes],
    },
    selectionReasons: [...occurrence.prescribed.selectionReasons],
  };
}

function sharedPrimaryMuscles(
  original: CatalogExercise,
  alternative: CatalogExercise,
): string[] {
  const originalMuscles = new Set(original.primaryMuscles.map(normalizeMuscle));
  return alternative.primaryMuscles.filter((muscle) =>
    originalMuscles.has(normalizeMuscle(muscle)),
  );
}

function compatibilityReasons(
  original: CatalogExercise,
  alternative: CatalogExercise,
  requiredEquipment: readonly string[],
): string[] {
  const reasons: string[] = [];
  if (alternative.substitutionGroup === original.substitutionGroup) {
    reasons.push(
      `Pertenece al mismo grupo de sustitución curado: ${original.substitutionGroup}.`,
    );
  }
  if (alternative.movementPattern === original.movementPattern) {
    reasons.push(
      `Mantiene el patrón de movimiento ${original.movementPattern}.`,
    );
  }
  const sharedMuscles = sharedPrimaryMuscles(original, alternative);
  if (sharedMuscles.length > 0) {
    reasons.push(`Comparte musculatura principal: ${sharedMuscles.join(", ")}.`);
  }
  if (requiredEquipment.length > 0) {
    const requested = new Set(requiredEquipment.map(normalizeEquipment));
    const matches = alternative.equipment.filter((equipment) =>
      requested.has(normalizeEquipment(equipment)),
    );
    if (matches.length > 0) {
      reasons.push(`Usa el equipamiento solicitado: ${matches.join(", ")}.`);
    }
  }
  reasons.push(
    "Cumple el equipamiento y las exclusiones de la solicitud validada.",
  );
  return reasons
    .slice(0, GROUNDED_EXERCISE_CONTEXT_LIMITS.alternativeReasons)
    .map((reason) => boundedText(reason, 300));
}

function groundedAlternatives(
  original: CatalogExercise,
  request: RoutineRequest,
  plan: RoutinePlan | null,
  limit: number,
  requiredEquipment: readonly string[],
): GroundedExerciseAlternative[] {
  const usedExerciseIds =
    plan?.days
      .flatMap((day) => day.exercises)
      .map((exercise) => exercise.exerciseId)
      .filter((exerciseId) => exerciseId !== original.id) ?? [];
  const requiredEquipmentSet = new Set(
    requiredEquipment.map(normalizeEquipment),
  );

  return findSubstitutions(original.id, routineCatalog, request, {
    excludeExerciseIds: usedExerciseIds,
    limit: routineCatalog.length,
    seed: `${plan?.seed ?? "no-plan"}:grounded-alternatives:${original.id}`,
  })
    .filter(
      (candidate) =>
        requiredEquipmentSet.size === 0 ||
        candidate.equipment.some((equipment) =>
          requiredEquipmentSet.has(normalizeEquipment(equipment)),
        ),
    )
    .flatMap((candidate) => {
      const detail = getExerciseDetailById(candidate.id);
      if (!detail || !detail.approvedForGeneration) {
        return [];
      }
      return [
        {
          id: candidate.id,
          displayName: boundedText(
            detail.displayName,
            GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
          ),
          displayNameEs: detail.displayNameEs
            ? boundedText(
                detail.displayNameEs,
                GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
              )
            : null,
          primaryMuscles: boundedList(
            detail.primaryMuscles,
            GROUNDED_EXERCISE_CONTEXT_LIMITS.primaryMuscles,
          ),
          secondaryMuscles: boundedList(
            detail.secondaryMuscles,
            GROUNDED_EXERCISE_CONTEXT_LIMITS.secondaryMuscles,
          ),
          requiredEquipment: boundedList(candidate.equipment, 8),
          difficulty: candidate.difficulty,
          movementPattern: candidate.movementPattern,
          modality: candidate.modality,
          substitutionGroup: candidate.substitutionGroup,
          mediaAvailable: detail.mediaAvailable,
          compatibilityReasons: compatibilityReasons(
            original,
            candidate,
            requiredEquipment,
          ),
        } satisfies GroundedExerciseAlternative,
      ];
    })
    .slice(0, limit);
}

/**
 * Resolves bounded exercise truth without network access or model inference.
 * Natural-language intent/target parsing must happen before this boundary.
 */
export function resolveGroundedExerciseContext(
  input: GroundedExerciseContextInput,
): GroundedExerciseContextResult {
  const validatedPlan = validateRoutineContext(input.routinePlan);
  if (!validatedPlan.ok) {
    return validatedPlan.result;
  }

  const resolvedTarget = resolveTarget(input.target, validatedPlan.plan);
  if (!resolvedTarget.ok) {
    return resolvedTarget.result;
  }

  if (
    input.questionKind === "selection_reason" &&
    !resolvedTarget.occurrence
  ) {
    return {
      ok: false,
      code: "EXERCISE_NOT_IN_ROUTINE",
      message:
        "No hay una selección de ese ejercicio en la rutina actual para explicar.",
    };
  }

  const detail = getExerciseDetailById(resolvedTarget.exerciseId);
  if (!detail) {
    return {
      ok: false,
      code: "EXERCISE_NOT_FOUND",
      message: "El ejercicio indicado no existe en el catálogo local validado.",
    };
  }
  const curated = routineExerciseById.get(resolvedTarget.exerciseId);

  let alternatives: GroundedExerciseAlternative[] = [];
  let alternativeConstraints: GroundedExerciseContext["alternativeConstraints"] =
    null;
  if (input.questionKind === "alternatives") {
    const parsedRequest = RoutineRequestSchema.safeParse(input.routineRequest);
    if (!parsedRequest.success) {
      return {
        ok: false,
        code: "INVALID_REQUEST_CONTEXT",
        message: "La solicitud de rutina actual no tiene una estructura válida.",
      };
    }
    if (!curated || !detail.approvedForGeneration) {
      return {
        ok: false,
        code: "EXERCISE_NOT_APPROVED",
        message:
          "Ese ejercicio no pertenece al catálogo curado para generar sustituciones.",
      };
    }

    const requestedLimit = Number.isFinite(input.alternativesLimit)
      ? Math.floor(input.alternativesLimit ?? 3)
      : 3;
    const limit = Math.min(
      GROUNDED_EXERCISE_CONTEXT_LIMITS.alternatives,
      Math.max(1, requestedLimit),
    );
    const requiredEquipment = [
      ...new Set(
        (input.requiredAlternativeEquipment ?? [])
          .slice(0, 4)
          .map((equipment) =>
            normalizeEquipment(
              boundedText(
                equipment,
                GROUNDED_EXERCISE_CONTEXT_LIMITS.metadataCharacters,
              ),
            ),
          )
          .filter(Boolean),
      ),
    ];
    alternatives = groundedAlternatives(
      curated,
      parsedRequest.data,
      validatedPlan.plan,
      limit,
      requiredEquipment,
    );
    alternativeConstraints = { requiredEquipment };
  }

  return {
    ok: true,
    context: {
      questionKind: input.questionKind,
      exercise: exerciseFacts(detail, curated),
      routine:
        validatedPlan.plan && resolvedTarget.occurrence
          ? routineContext(validatedPlan.plan, resolvedTarget.occurrence)
          : null,
      alternatives,
      alternativeConstraints,
      grounding: {
        source: "validated_local_catalog",
        datasetCommit: EXERCISE_DATASET_COMMIT,
        routineContextSource: resolvedTarget.occurrence
          ? "current_routine_plan"
          : null,
      },
    },
  };
}
