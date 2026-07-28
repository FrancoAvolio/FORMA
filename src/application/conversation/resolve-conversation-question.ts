import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import { normalizeDomainText } from "../../domain/exercises/normalization";
import type { RoutinePlan } from "../../domain/routine/schemas";
import type { GroundedExerciseQuestionKind } from "./grounded-exercise-context";

export type ConversationExerciseTarget = {
  exerciseId: string;
  dayId: string;
};

export type ConversationQuestionResolution =
  | {
      kind: "exercise";
      questionKind: GroundedExerciseQuestionKind;
      target: ConversationExerciseTarget;
      requiredAlternativeEquipment: string[];
    }
  | { kind: "routine_explanation" }
  | { kind: "unknown" };

function questionKind(message: string): GroundedExerciseQuestionKind {
  if (/otra opcion|alternativa|reemplaz|cambiar por/u.test(message)) {
    return "alternatives";
  }
  if (/como (se hace|hacer)|tecnica|ejecucion|instruccion/u.test(message)) {
    return "instructions";
  }
  if (/que (musculo|musculos|trabaja)|para que sirve/u.test(message)) {
    return "muscles";
  }
  if (/por que|elegiste|pusiste|seleccionaste/u.test(message)) {
    return "selection_reason";
  }
  return "overview";
}

function requestedAlternativeEquipment(message: string): string[] {
  const requested: string[] = [];
  const includes = (pattern: RegExp) => pattern.test(message);
  const pullUpBar = includes(/\bbarra de (dominadas|pull ups?)\b/u);
  const smithMachine = includes(/\b(smith|maquina smith)\b/u);

  if (includes(/\b(polea|poleas|cable|cables)\b/u)) requested.push("cable");
  if (includes(/\b(mancuerna|mancuernas|dumbbell|dumbbells)\b/u)) {
    requested.push("dumbbell");
  }
  if (pullUpBar) requested.push("pull_up_bar");
  else if (includes(/\b(barra|barbell)\b/u)) requested.push("barbell");
  if (smithMachine) requested.push("smith_machine");
  else if (includes(/\b(maquina|maquinas|machine|machines)\b/u)) {
    requested.push("machine");
  }
  if (includes(/\b(pesa rusa|pesas rusas|kettlebell|kettlebells)\b/u)) {
    requested.push("kettlebell");
  }
  if (includes(/\b(banda|bandas|band|bands)\b/u)) {
    requested.push("resistance_band");
  }
  if (includes(/\b(peso corporal|body ?weight)\b/u)) {
    requested.push("body_weight");
  }
  if (includes(/\b(banco|bench)\b/u)) requested.push("bench");

  return [...new Set(requested)].slice(0, 4);
}

/** Resolves only exercises already present in the validated current plan. */
export function resolveConversationQuestion(options: {
  message: string;
  plan: RoutinePlan | null;
  catalog: readonly CatalogExercise[];
  activeExercise?: ConversationExerciseTarget | null;
}): ConversationQuestionResolution {
  const normalized = normalizeDomainText(options.message);
  if (!options.plan || normalized.length === 0) return { kind: "unknown" };

  const catalogById = new Map(
    options.catalog.map((exercise) => [exercise.id, exercise]),
  );
  const placements = options.plan.days.flatMap((day) =>
    day.exercises.flatMap((prescribed) => {
      const exercise = catalogById.get(prescribed.exerciseId);
      return exercise
        ? [{ dayId: day.id, exerciseId: exercise.id, exercise }]
        : [];
    }),
  );
  const named = placements
    .filter(({ exercise }) =>
      [exercise.name, exercise.sourceName ?? "", ...exercise.aliases]
        .map(normalizeDomainText)
        .filter((name) => name.length >= 4)
        .some((name) => normalized.includes(name)),
    )
    .sort(
      (left, right) =>
        normalizeDomainText(right.exercise.name).length -
        normalizeDomainText(left.exercise.name).length,
    )[0];
  const resolvedQuestionKind = questionKind(normalized);
  const contextualLanguage =
    /este ejercicio|ese ejercicio|este movimiento|por que lo|como lo/u.test(
      normalized,
    ) || resolvedQuestionKind === "alternatives";
  const target = named
    ? { exerciseId: named.exerciseId, dayId: named.dayId }
    : contextualLanguage && options.activeExercise
      ? options.activeExercise
      : null;

  if (target) {
    const placementExists = placements.some(
      (placement) =>
        placement.exerciseId === target.exerciseId &&
        placement.dayId === target.dayId,
    );
    if (placementExists) {
      return {
        kind: "exercise",
        questionKind: resolvedQuestionKind,
        target,
        requiredAlternativeEquipment:
          resolvedQuestionKind === "alternatives"
            ? requestedAlternativeEquipment(normalized)
            : [],
      };
    }
  }

  if (/rutina|plan|division|semana/u.test(normalized)) {
    return { kind: "routine_explanation" };
  }
  return { kind: "unknown" };
}
