import type { Metadata } from "next";

import { RoutineViewer } from "@/components/routines/routine-viewer";
import { getRoutineCatalog } from "@/data/routine-catalog";
import { resolveExerciseMedia } from "@/media/server";

export const metadata: Metadata = {
  title: "Mi rutina",
  description: "Revisá, editá y guardá tu rutina validada de FORMA.",
};

export default function RoutinePage() {
  const catalog = getRoutineCatalog();
  const media = Object.fromEntries(
    catalog.map((exercise) => [exercise.id, resolveExerciseMedia(exercise.id)]),
  );

  return <RoutineViewer catalog={catalog} media={media} />;
}
