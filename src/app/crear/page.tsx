import type { Metadata } from "next";

import { GuidedRoutineBuilder } from "@/components/routines/guided-routine-builder";
import { EXERCISE_DATASET_COMMIT } from "@/data/catalog";
import { getRoutineCatalog } from "@/data/routine-catalog";

export const metadata: Metadata = {
  title: "Crear mi rutina",
  description: "Completá el formulario guiado y generá una rutina validada sin depender de IA.",
};

type SearchParameters = Record<string, string | string[] | undefined>;

export default async function CreateRoutinePage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const parameters = await searchParams;
  const rawExample = parameters.ejemplo;
  const example = Array.isArray(rawExample) ? rawExample[0] : rawExample;

  return (
    <GuidedRoutineBuilder
      catalog={getRoutineCatalog()}
      datasetVersion={EXERCISE_DATASET_COMMIT}
      example={example}
    />
  );
}
