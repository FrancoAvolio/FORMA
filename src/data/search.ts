import MiniSearch, { type Options } from "minisearch";

import generatedIndex from "./generated/exercise-index.json";
import { getExerciseSummaries } from "./catalog";
import type { ExerciseSummary } from "./types";

export type ExerciseSearchFilters = {
  bodyPart?: string;
  equipment?: string;
  primaryMuscle?: string;
  movementPattern?: string;
  difficulty?: string;
  approvedOnly?: boolean;
  mediaAvailable?: boolean;
};

type SearchDocument = Pick<
  ExerciseSummary,
  | "id"
  | "displayName"
  | "reviewStatus"
  | "bodyPart"
  | "equipment"
  | "primaryMuscles"
  | "movementPattern"
  | "mediaAvailable"
>;

let memoizedSearch: MiniSearch<SearchDocument> | null = null;
const summaries = getExerciseSummaries();
const summaryById = new Map(summaries.map((exercise) => [exercise.id, exercise]));
const spanishCollator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[_-]+/gu, " ")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function getSearch(): MiniSearch<SearchDocument> {
  if (memoizedSearch) return memoizedSearch;
  memoizedSearch = MiniSearch.loadJSON<SearchDocument>(
    JSON.stringify(generatedIndex.serializedIndex),
    generatedIndex.miniSearchOptions as Options<SearchDocument>,
  );
  return memoizedSearch;
}

export function expandExerciseQuery(query: string): string {
  const normalizedQuery = normalize(query);
  const expansions = new Set([normalizedQuery]);
  for (const [alias, targets] of Object.entries(generatedIndex.queryAliases)) {
    const normalizedAlias = normalize(alias);
    if (
      normalizedQuery === normalizedAlias ||
      ` ${normalizedQuery} `.includes(` ${normalizedAlias} `)
    ) {
      for (const target of targets) expansions.add(normalize(target));
    }
  }
  return [...expansions].filter(Boolean).join(" ");
}

function equalsNormalized(left: string, right: string): boolean {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (normalizedLeft === normalizedRight) return true;
  for (const [alias, targets] of Object.entries(generatedIndex.queryAliases)) {
    if (normalize(alias) !== normalizedRight) continue;
    if (targets.some((target) => normalize(target) === normalizedLeft)) return true;
  }
  return false;
}

function matchesFilters(exercise: ExerciseSummary, filters: ExerciseSearchFilters): boolean {
  if (filters.approvedOnly && !exercise.approvedForGeneration) return false;
  if (
    filters.mediaAvailable !== undefined &&
    exercise.mediaAvailable !== filters.mediaAvailable
  ) {
    return false;
  }
  if (filters.bodyPart && !equalsNormalized(exercise.bodyPart, filters.bodyPart)) return false;
  if (
    filters.equipment &&
    !exercise.requiredEquipment.some((equipment) =>
      equalsNormalized(equipment, filters.equipment!),
    )
  ) {
    return false;
  }
  if (
    filters.primaryMuscle &&
    !exercise.primaryMuscles.some((muscle) => equalsNormalized(muscle, filters.primaryMuscle!))
  ) {
    return false;
  }
  if (
    filters.movementPattern &&
    (!exercise.movementPattern ||
      !equalsNormalized(exercise.movementPattern, filters.movementPattern))
  ) {
    return false;
  }
  if (
    filters.difficulty &&
    (!exercise.difficulty || !equalsNormalized(exercise.difficulty, filters.difficulty))
  ) {
    return false;
  }
  return true;
}

export function searchExercises(
  query: string,
  filters: ExerciseSearchFilters = {},
  limit = 40,
): ExerciseSummary[] {
  const boundedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return searchExerciseResults(query, filters).slice(0, boundedLimit);
}

/** Full ordered result set for the application pagination adapter. */
export function searchExerciseResults(
  query: string,
  filters: ExerciseSearchFilters = {},
): ExerciseSummary[] {
  const trimmedQuery = query.trim();
  const exactId = /^\d{4}$/u.test(trimmedQuery) ? trimmedQuery : null;
  const exactExercise = exactId ? summaryById.get(exactId) : undefined;
  const expandedQuery = exactId ? "" : expandExerciseQuery(query);
  const ordered = exactId
    ? exactExercise
      ? [exactExercise]
      : []
    : expandedQuery
      ? getSearch()
          .search(expandedQuery)
          .map((result) => summaryById.get(String(result.id)))
          .filter((exercise): exercise is ExerciseSummary => exercise !== undefined)
      : [...summaries].sort(
          (left, right) =>
            spanishCollator.compare(left.displayName, right.displayName) ||
            left.id.localeCompare(right.id, "en"),
        );

  return ordered.filter((exercise) => matchesFilters(exercise, filters));
}
