import type { Metadata } from "next";

import { SavedRoutines } from "@/components/routines/saved-routines";

export const metadata: Metadata = {
  title: "Rutinas guardadas",
  description: "Rutinas almacenadas únicamente en este navegador.",
};

export default function SavedRoutinesPage() {
  return <SavedRoutines />;
}
