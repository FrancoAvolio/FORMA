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
      title: "Entrada en calor general",
      description:
        "Movimiento suave y progresivo para elevar el ritmo antes de las series de trabajo.",
      estimatedMinutes: budget.generalWarmupMinutes,
      relatedExerciseIds: [],
    },
    {
      kind: "specific_preparation",
      title: "Aproximaci\u00f3n y t\u00e9cnica",
      description:
        "Series progresivas de preparaci\u00f3n para los primeros movimientos; no cuentan como series efectivas.",
      estimatedMinutes: budget.specificPreparationMinutes,
      relatedExerciseIds: preparationTargets,
    },
    {
      kind: "cooldown",
      title: "Vuelta a la calma y registro",
      description:
        "Baj\u00e1 el ritmo de forma gradual y registr\u00e1 cargas o ajustes para la pr\u00f3xima sesi\u00f3n.",
      estimatedMinutes: budget.cooldownMinutes,
      relatedExerciseIds: [],
    },
  ];
}
