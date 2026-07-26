import type {
  ExperienceLevel,
  RoutineGoal,
} from "../../profile/routine-request";

export type WeeklyVolumeRange = {
  minimumFocusSets: number;
  maximumSets: number;
};

export const WEEKLY_VOLUME_RULES: Readonly<
  Record<RoutineGoal, Readonly<Record<ExperienceLevel, WeeklyVolumeRange>>>
> = {
  hypertrophy: {
    beginner: { minimumFocusSets: 4, maximumSets: 15 },
    intermediate: { minimumFocusSets: 6, maximumSets: 18 },
    advanced: { minimumFocusSets: 8, maximumSets: 24 },
  },
  strength: {
    beginner: { minimumFocusSets: 3, maximumSets: 15 },
    intermediate: { minimumFocusSets: 4, maximumSets: 16 },
    advanced: { minimumFocusSets: 5, maximumSets: 20 },
  },
  general_fitness: {
    beginner: { minimumFocusSets: 2, maximumSets: 14 },
    intermediate: { minimumFocusSets: 3, maximumSets: 15 },
    advanced: { minimumFocusSets: 4, maximumSets: 18 },
  },
  muscular_endurance: {
    beginner: { minimumFocusSets: 3, maximumSets: 14 },
    intermediate: { minimumFocusSets: 4, maximumSets: 18 },
    advanced: { minimumFocusSets: 5, maximumSets: 20 },
  },
};
