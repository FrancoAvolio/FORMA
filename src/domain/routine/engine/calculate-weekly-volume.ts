import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { normalizeMuscle } from "../../exercises/normalization";
import type { RoutinePlan } from "../schemas";

export type MuscleWeeklyVolume = {
  directSets: number;
  indirectSets: number;
  totalSets: number;
};

export type WeeklyVolume = Record<string, MuscleWeeklyVolume>;

function ensureMuscle(volume: WeeklyVolume, muscle: string): MuscleWeeklyVolume {
  volume[muscle] ??= { directSets: 0, indirectSets: 0, totalSets: 0 };
  return volume[muscle];
}

export function calculateWeeklyVolume(
  plan: RoutinePlan,
  catalog: readonly CatalogExercise[],
): WeeklyVolume {
  const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const volume: WeeklyVolume = {};

  for (const day of plan.days) {
    for (const prescribed of day.exercises) {
      const exercise = catalogById.get(prescribed.exerciseId);
      if (!exercise) {
        continue;
      }
      for (const rawMuscle of exercise.primaryMuscles) {
        const muscle = ensureMuscle(volume, normalizeMuscle(rawMuscle));
        muscle.directSets += prescribed.sets;
        muscle.totalSets += prescribed.sets;
      }
      for (const rawMuscle of exercise.secondaryMuscles) {
        const muscle = ensureMuscle(volume, normalizeMuscle(rawMuscle));
        const indirectContribution = prescribed.sets * 0.5;
        muscle.indirectSets += indirectContribution;
        muscle.totalSets += indirectContribution;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(volume)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([muscle, values]) => [
        muscle,
        {
          directSets: Number(values.directSets.toFixed(1)),
          indirectSets: Number(values.indirectSets.toFixed(1)),
          totalSets: Number(values.totalSets.toFixed(1)),
        },
      ]),
  );
}

