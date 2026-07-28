import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import {
  hasTextMatch,
  normalizeEquipment,
} from "../../domain/exercises/normalization";
import {
  RoutineRequestSchema,
  type RoutineRequest,
} from "../../domain/profile/routine-request";
import { resolveAvailableEquipment } from "../../domain/routine/engine/build-candidate-pool";
import type { RoutinePlan } from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import type { SafetyScreening } from "../../domain/safety/schemas";
import {
  removeRoutineExercise,
  reorderRoutineExercise,
  shortenRoutineDay,
} from "./edit-routine";
import { generateRoutineUseCase } from "./generate-routine";
import { regenerateRoutineDay } from "./regenerate-day";
import {
  findRoutineExerciseSubstitutions,
  replaceRoutineExercise,
} from "./replace-exercise";
import type { RoutineMutationResult } from "./types";

export type ConversationRoutineModification =
  | { kind: "update_request"; patch: Partial<RoutineRequest> }
  | {
      kind: "replace_exercise";
      dayId: string;
      exerciseId: string;
      requestedAlternative: string | null;
    }
  | { kind: "remove_exercise"; dayId: string; exerciseId: string }
  | {
      kind: "reorder_exercise";
      dayId: string;
      exerciseId: string;
      targetPosition: number;
    }
  | { kind: "regenerate_day"; dayId: string }
  | { kind: "shorten_day"; dayId: string; targetMinutes: number | null }
  | { kind: "exclude_equipment"; equipment: string[] };

export type ApplyConversationModificationInput = {
  modification: ConversationRoutineModification;
  plan: RoutinePlan;
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
  datasetVersion: string;
  seed: string;
};

export type ApplyConversationModificationResult =
  | {
      ok: true;
      request: RoutineRequest;
      plan: RoutinePlan;
      changedScope: "profile" | "exercise" | "day" | "routine";
      summary: string;
    }
  | { ok: false; code: string; message: string };

function fromMutation(
  result: RoutineMutationResult,
  request: RoutineRequest,
  changedScope: "exercise" | "day",
  summary: string,
): ApplyConversationModificationResult {
  return result.ok
    ? { ok: true, request, plan: result.plan, changedScope, summary }
    : { ok: false, code: result.code, message: result.message };
}

function alternativeMatches(
  exercise: CatalogExercise,
  requestedAlternative: string,
): boolean {
  return hasTextMatch(
    [
      exercise.id,
      exercise.name,
      exercise.sourceName ?? "",
      ...exercise.aliases,
      ...exercise.equipment,
      ...exercise.primaryMuscles,
      exercise.movementPattern,
    ],
    [requestedAlternative],
  );
}

/**
 * Applies a validated language command through existing deterministic use cases.
 * Provider output identifies intent only; this function owns all authoritative changes.
 */
export function applyConversationRoutineModification(
  input: ApplyConversationModificationInput,
): ApplyConversationModificationResult {
  const modification = input.modification;
  const common = {
    plan: input.plan,
    request: input.request,
    safetyScreening: input.safetyScreening,
    catalog: input.catalog,
  };

  switch (modification.kind) {
    case "replace_exercise": {
      const alternatives = findRoutineExerciseSubstitutions({
        ...common,
        dayId: modification.dayId,
        exerciseId: modification.exerciseId,
        seed: input.seed,
        limit: 24,
      });
      const replacement = modification.requestedAlternative
        ? alternatives.find((exercise) =>
            alternativeMatches(
              exercise,
              modification.requestedAlternative as string,
            ),
          )
        : alternatives[0];
      if (!replacement) {
        return {
          ok: false,
          code: "NO_SUBSTITUTION",
          message: modification.requestedAlternative
            ? "No encontramos una alternativa aprobada que coincida con ese pedido."
            : "No encontramos una sustitución aprobada y compatible.",
        };
      }
      const original = input.catalog.find(
        (exercise) => exercise.id === modification.exerciseId,
      );
      return fromMutation(
        replaceRoutineExercise({
          ...common,
          dayId: modification.dayId,
          exerciseId: modification.exerciseId,
          replacementExerciseId: replacement.id,
          seed: input.seed,
        }),
        input.request,
        "exercise",
        `Reemplacé ${original?.name ?? "el ejercicio"} por ${replacement.name} y volví a validar la rutina.`,
      );
    }
    case "remove_exercise": {
      const exercise = input.catalog.find(
        (candidate) => candidate.id === modification.exerciseId,
      );
      return fromMutation(
        removeRoutineExercise({
          ...common,
          dayId: modification.dayId,
          exerciseId: modification.exerciseId,
        }),
        input.request,
        "exercise",
        `Quité ${exercise?.name ?? "el ejercicio"} y la rutina sigue dentro de las reglas.`,
      );
    }
    case "reorder_exercise": {
      const day = input.plan.days.find(
        (candidate) => candidate.id === modification.dayId,
      );
      const fromIndex =
        day?.exercises.findIndex(
          (exercise) => exercise.exerciseId === modification.exerciseId,
        ) ?? -1;
      return fromMutation(
        reorderRoutineExercise({
          ...common,
          dayId: modification.dayId,
          fromIndex,
          toIndex: modification.targetPosition,
        }),
        input.request,
        "exercise",
        "Reordené ese ejercicio sin modificar los demás días.",
      );
    }
    case "regenerate_day":
      return fromMutation(
        regenerateRoutineDay({
          ...common,
          dayId: modification.dayId,
          seed: input.seed,
        }),
        input.request,
        "day",
        "Regeneré sólo el día indicado y conservé intacto el resto de la semana.",
      );
    case "shorten_day": {
      const shortened = shortenRoutineDay({
        ...common,
        dayId: modification.dayId,
        targetMinutes: modification.targetMinutes,
      });
      const previousMinutes = input.plan.days.find(
        (day) => day.id === modification.dayId,
      )?.estimatedMinutes;
      const nextMinutes = shortened.ok
        ? shortened.plan.days.find((day) => day.id === modification.dayId)
            ?.estimatedMinutes
        : undefined;
      return fromMutation(
        shortened,
        input.request,
        "day",
        previousMinutes && nextMinutes
          ? `Acorté ese día de ${previousMinutes} a ${nextMinutes} minutos y volví a validar la rutina completa.`
          : "Acorté sólo el día indicado y volví a validar la rutina completa.",
      );
    }
    case "exclude_equipment": {
      const excluded = new Set(
        modification.equipment.map((equipment) => normalizeEquipment(equipment)),
      );
      const effectiveEquipment = [
        ...new Set(
          resolveAvailableEquipment(input.request).map((equipment) =>
            normalizeEquipment(equipment),
          ),
        ),
      ];
      const availableEquipment = effectiveEquipment.filter(
        (equipment) => !excluded.has(equipment),
      );
      if (availableEquipment.length === effectiveEquipment.length) {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message:
            "Ese equipamiento no forma parte del perfil actual, así que no había nada que quitar.",
        };
      }
      if (availableEquipment.length === 0) {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message:
            "El cambio dejaría el perfil sin ninguna opción de equipamiento utilizable.",
        };
      }

      const updated = applyConversationRoutineModification({
        ...input,
        modification: {
          kind: "update_request",
          patch: { availableEquipment },
        },
      });
      if (!updated.ok) return updated;
      const label = [...excluded].join(", ");
      return {
        ...updated,
        summary:
          updated.plan === input.plan
            ? `Saqué ${label} del equipamiento disponible. La rutina actual ya cumplía esa restricción, así que conservé sus ejercicios.`
            : `Saqué ${label} del equipamiento disponible y reconstruí la rutina porque el plan anterior usaba ese material. La nueva versión quedó validada.`,
      };
    }
    case "update_request": {
      const parsedRequest = RoutineRequestSchema.safeParse({
        ...input.request,
        ...modification.patch,
      });
      if (!parsedRequest.success) {
        return {
          ok: false,
          code: "INVALID_INPUT",
          message: "El cambio de perfil no respeta los límites admitidos.",
        };
      }
      const nextRequest = parsedRequest.data;
      const currentValidation = validateRoutine(
        input.plan,
        nextRequest,
        input.catalog,
        input.safetyScreening,
      );
      if (currentValidation.valid) {
        return {
          ok: true,
          request: nextRequest,
          plan: input.plan,
          changedScope: "profile",
          summary:
            "Actualicé el perfil. La rutina actual ya cumple el nuevo pedido, así que no cambié ejercicios innecesariamente.",
        };
      }

      const regenerated = generateRoutineUseCase({
        request: nextRequest,
        safetyScreening: input.safetyScreening,
        catalog: input.catalog,
        datasetVersion: input.datasetVersion,
        seed: input.seed,
      });
      if (!regenerated.ok) {
        return {
          ok: false,
          code: regenerated.code,
          message: regenerated.message,
        };
      }
      return {
        ok: true,
        request: nextRequest,
        plan: regenerated.plan,
        changedScope: "routine",
        summary:
          "El cambio afectaba la estructura del plan, así que reconstruí y validé la rutina completa con el perfil actualizado.",
      };
    }
  }
}
