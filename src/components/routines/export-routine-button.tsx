"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";

import type { RoutineExportCatalog } from "@/application/routines/routine-pdf-export";
import {
  prepareRoutinePdf,
  type PreparedRoutinePdf,
} from "@/browser/prepare-routine-pdf";
import {
  canShareRoutinePdf,
  downloadRoutinePdf,
  shareRoutinePdf,
} from "@/browser/routine-pdf-file";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";

import styles from "./export-routine-button.module.css";

export type ExportRoutineButtonProps = {
  plan: RoutinePlan;
  catalog: RoutineExportCatalog;
  media:
    | Readonly<Record<string, ExerciseMedia>>
    | ReadonlyMap<string, ExerciseMedia>;
  disabled?: boolean;
};

export function ExportRoutineButton({
  plan,
  catalog,
  media,
  disabled = false,
}: ExportRoutineButtonProps) {
  const [statusState, setStatusState] = useState<{
    plan: RoutinePlan;
    text: string;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [preparedState, setPreparedState] = useState<{
    plan: RoutinePlan;
    pdf: PreparedRoutinePdf;
  } | null>(null);
  const preparedPdf = preparedState?.plan === plan ? preparedState.pdf : null;
  const status = statusState?.plan === plan ? statusState.text : null;
  const setStatus = (text: string | null) =>
    setStatusState(text === null ? null : { plan, text });

  const preparePdf = () => {
    setWorking(true);
    setPreparedState(null);
    setStatus("Armando el PDF con imágenes e instrucciones…");
    void prepareRoutinePdf({
      plan,
      catalog,
      media,
      origin: window.location.origin,
    })
      .then((prepared) => {
        setPreparedState({ plan, pdf: prepared });
        setStatus("PDF listo. Ahora podés guardarlo o compartirlo.");
      })
      .catch(() =>
        setStatus("No pudimos crear el PDF. Intentá nuevamente."),
      )
      .finally(() => setWorking(false));
  };

  return (
    <div className={styles.root}>
      <div className={styles.primaryActions}>
        <button
          className="button button-secondary"
          type="button"
          disabled={disabled || working}
          onClick={preparePdf}
        >
          <Download aria-hidden="true" />
          {working
            ? "Creando PDF…"
            : preparedPdf
              ? "Volver a crear PDF"
              : "Exportar PDF"}
        </button>

        {preparedPdf ? (
          <span className={styles.readyActions}>
            <button
              className={`button button-primary ${styles.savePdf}`}
              type="button"
              onClick={() => {
                downloadRoutinePdf(preparedPdf);
                setStatus("Descargamos tu rutina en PDF.");
              }}
            >
              <Download aria-hidden="true" /> Guardar PDF
            </button>
            {canShareRoutinePdf(preparedPdf) ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  void shareRoutinePdf(preparedPdf)
                    .then((outcome) => {
                      if (outcome === "shared") {
                        setStatus("PDF compartido desde tu dispositivo.");
                      }
                    })
                    .catch(() =>
                      setStatus("No pudimos compartir el PDF. Podés guardarlo."),
                    );
                }}
              >
                <Share2 aria-hidden="true" /> Compartir PDF
              </button>
            ) : null}
          </span>
        ) : null}
      </div>

      {status ? (
        <span className={styles.status} role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
