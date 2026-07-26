import type { CatalogExercise } from "../../domain/exercises/catalog-exercise";
import type { RoutineRequest } from "../../domain/profile/routine-request";
import type { SafetyScreening } from "../../domain/safety/schemas";
import { estimateSessionDuration } from "../../domain/routine/engine/estimate-session-duration";
import {
  RoutineExerciseSchema,
  type RoutineExercise,
  type RoutinePlan,
} from "../../domain/routine/schemas";
import { validateRoutine } from "../../domain/routine/validators/validate-routine";
import type { RoutineMutationResult } from "./types";

type SharedEditInput = {
  plan: RoutinePlan;
  request: RoutineRequest;
  safetyScreening: SafetyScreening;
  catalog: readonly CatalogExercise[];
  dayId: string;
};

function validateMutation(
  plan: RoutinePlan,
  input: SharedEditInput,
): RoutineMutationResult {
  const validation = validateRoutine(
    plan,
    input.request,
    input.catalog,
    input.safetyScreening,
  );
  if (!validation.valid) {
    return {
      ok: false,
      code: "INVALID_ROUTINE",
      message:
        validation.errors[0]?.message ??
        "El cambio dejaría la rutina fuera de los límites validados.",
      candidatePlan: plan,
      validation,
    };
  }
  return { ok: true, plan, validation };
}

export function removeRoutineExercise(
  input: SharedEditInput & { exerciseId: string },
): RoutineMutationResult {
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  const day = input.plan.days[dayIndex];
  if (!day) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  if (!day.exercises.some((exercise) => exercise.exerciseId === input.exerciseId)) {
    return { ok: false, code: "EXERCISE_NOT_FOUND", message: "No se encontró el ejercicio indicado." };
  }
  if (day.exercises.length === 1) {
    return {
      ok: false,
      code: "INVALID_POSITION",
      message: "Un día de entrenamiento no puede quedar vacío.",
    };
  }
  const nextExercises = day.exercises.filter(
    (exercise) => exercise.exerciseId !== input.exerciseId,
  );
  const nextDay = {
    ...day,
    exercises: nextExercises,
    estimatedMinutes: estimateSessionDuration(nextExercises, input.catalog),
  };
  return validateMutation(
    {
      ...input.plan,
      days: input.plan.days.map((routineDay, index) =>
        index === dayIndex ? nextDay : routineDay,
      ),
    },
    input,
  );
}

export function reorderRoutineExercise(
  input: SharedEditInput & { fromIndex: number; toIndex: number },
): RoutineMutationResult {
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  const day = input.plan.days[dayIndex];
  if (!day) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  if (
    !Number.isInteger(input.fromIndex) ||
    !Number.isInteger(input.toIndex) ||
    input.fromIndex < 0 ||
    input.toIndex < 0 ||
    input.fromIndex >= day.exercises.length ||
    input.toIndex >= day.exercises.length
  ) {
    return { ok: false, code: "INVALID_POSITION", message: "La posición indicada no es válida." };
  }
  const nextExercises = [...day.exercises];
  const [moved] = nextExercises.splice(input.fromIndex, 1);
  if (!moved) {
    return { ok: false, code: "EXERCISE_NOT_FOUND", message: "No se encontró el ejercicio indicado." };
  }
  nextExercises.splice(input.toIndex, 0, moved);
  const nextDay = { ...day, exercises: nextExercises };
  return validateMutation(
    {
      ...input.plan,
      days: input.plan.days.map((routineDay, index) =>
        index === dayIndex ? nextDay : routineDay,
      ),
    },
    input,
  );
}

export type EditablePrescription = Pick<
  RoutineExercise,
  "sets" | "repPrescription" | "restSeconds" | "rir" | "tempo"
>;

export function editRoutineExercisePrescription(
  input: SharedEditInput & {
    exerciseId: string;
    patch: Partial<EditablePrescription>;
  },
): RoutineMutationResult {
  const dayIndex = input.plan.days.findIndex((day) => day.id === input.dayId);
  const day = input.plan.days[dayIndex];
  if (!day) {
    return { ok: false, code: "DAY_NOT_FOUND", message: "No se encontró el día indicado." };
  }
  const exerciseIndex = day.exercises.findIndex(
    (exercise) => exercise.exerciseId === input.exerciseId,
  );
  const exercise = day.exercises[exerciseIndex];
  if (!exercise) {
    return { ok: false, code: "EXERCISE_NOT_FOUND", message: "No se encontró el ejercicio indicado." };
  }
  const parsed = RoutineExerciseSchema.safeParse({ ...exercise, ...input.patch });
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_PRESCRIPTION",
      message: parsed.error.issues.map((issue) => issue.message).join("; "),
    };
  }
  const nextExercises = day.exercises.map((routineExercise, index) =>
    index === exerciseIndex ? parsed.data : routineExercise,
  );
  const nextDay = {
    ...day,
    exercises: nextExercises,
    estimatedMinutes: estimateSessionDuration(nextExercises, input.catalog),
  };
  return validateMutation(
    {
      ...input.plan,
      days: input.plan.days.map((routineDay, index) =>
        index === dayIndex ? nextDay : routineDay,
      ),
    },
    input,
  );
}
