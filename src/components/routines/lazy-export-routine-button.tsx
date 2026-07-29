"use client";

import dynamic from "next/dynamic";

import type { ExportRoutineButtonProps } from "./export-routine-button";

const ClientExportRoutineButton = dynamic<ExportRoutineButtonProps>(
  () =>
    import("./export-routine-button").then(
      (module) => module.ExportRoutineButton,
    ),
  {
    ssr: false,
    loading: () => (
      <button className="button button-secondary" type="button" disabled>
        Preparando exportación…
      </button>
    ),
  },
);

export function LazyExportRoutineButton(props: ExportRoutineButtonProps) {
  return <ClientExportRoutineButton {...props} />;
}
