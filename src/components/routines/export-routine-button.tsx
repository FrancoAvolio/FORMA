"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";

import {
  createRoutineTextExport,
  type RoutineExportCatalog,
} from "@/application/routines/export-routine";
import { exportRoutineToDevice } from "@/browser/export-routine-to-device";
import type { RoutinePlan } from "@/domain/routine/schemas";

import styles from "./export-routine-button.module.css";

export function ExportRoutineButton({
  plan,
  catalog,
  disabled = false,
}: {
  plan: RoutinePlan;
  catalog: RoutineExportCatalog;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  return (
    <span className={styles.root}>
      <button
        className="button button-secondary"
        type="button"
        disabled={disabled || working}
        onClick={() => {
          const exported = createRoutineTextExport({
            plan,
            catalog,
            origin: window.location.origin,
          });
          setWorking(true);
          setStatus(null);
          void exportRoutineToDevice(exported)
            .then((outcome) => {
              if (outcome === "shared") {
                setStatus("Rutina lista para compartir.");
              } else if (outcome === "downloaded") {
                setStatus("Descargamos la rutina en formato de texto.");
              }
            })
            .catch(() =>
              setStatus("No pudimos preparar el archivo. Intentá nuevamente."),
            )
            .finally(() => setWorking(false));
        }}
      >
        {working ? (
          <Download aria-hidden="true" />
        ) : (
          <Share2 aria-hidden="true" />
        )}
        {working ? "Preparando…" : "Exportar al teléfono"}
      </button>
      <span className={styles.status} role="status">
        {status}
      </span>
    </span>
  );
}
