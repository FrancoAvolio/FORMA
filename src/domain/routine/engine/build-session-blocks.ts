import { sessionBlockBudget } from "../config/session-time";
import type {
  RoutineExercise,
  RoutineSessionBlock,
} from "../schemas";

/**
 * Creates visible, non-working parts of the session. They are intentionally
 * separate from effective sets and therefore never enter weekly volume.
 */
export function buildSessionBlocks(
  sessionMinutes: number,
  exercises: readonly RoutineExercise[],
): RoutineSessionBlock[] {
  const budget = sessionBlockBudget(sessionMinutes);
  const preparationTargets = exercises
    .slice(0, 2)
    .map((exercise) => exercise.exerciseId);

  return [
    {
      kind: "general_warmup",
      title: "Entrada en calor y movilidad",
      description:
        "Movimiento suave, movilidad y progresi\u00f3n gradual antes de las series de trabajo.",
      estimatedMinutes: budget.generalWarmupMinutes,
      relatedExerciseIds: [],
    },
    {
      kind: "specific_preparation",
      title: "Aproximaci\u00f3n y pr\u00e1ctica t\u00e9cnica",
      description:
        "Series progresivas de preparaci\u00f3n para los primeros movimientos; no cuentan como series efectivas.",
      estimatedMinutes: budget.specificPreparationMinutes,
      relatedExerciseIds: preparationTargets,
    },
    {
      kind: "cooldown",
      title: "Vuelta a la calma, movilidad y registro",
      description:
        "Baj\u00e1 el ritmo de forma gradual y registr\u00e1 cargas o ajustes para la pr\u00f3xima sesi\u00f3n.",
      estimatedMinutes: budget.cooldownMinutes,
      relatedExerciseIds: [],
    },
  ];
}

/**
 * Uses remaining requested time for visible low-fatigue session work. This
 * keeps the target honest without manufacturing effective sets or extending
 * exercise rests beyond their configured programming limits.
 */
export function expandSessionBlocksToTarget(
  blocks: readonly RoutineSessionBlock[],
  additionalMinutes: number,
): RoutineSessionBlock[] {
  const expanded = blocks.map((block) => ({
    ...block,
    relatedExerciseIds: [...block.relatedExerciseIds],
  }));
  let remaining = Math.max(0, Math.floor(additionalMinutes));
  const order: RoutineSessionBlock["kind"][] = [
    "specific_preparation",
    "general_warmup",
    "cooldown",
  ];

  for (const kind of order) {
    if (remaining === 0) break;
    const index = expanded.findIndex((block) => block.kind === kind);
    const block = expanded[index];
    if (!block) continue;
    const increase = Math.min(30 - block.estimatedMinutes, remaining);
    expanded[index] = {
      ...block,
      estimatedMinutes: block.estimatedMinutes + increase,
    };
    remaining -= increase;
  }

  return expanded;
}
