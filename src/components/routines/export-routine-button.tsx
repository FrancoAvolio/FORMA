"use client";

import { Download, FileText, Share2 } from "lucide-react";
import { useState } from "react";

import {
  createRoutineTextExport,
  type RoutineExportCatalog,
} from "@/application/routines/export-routine";
import { exportRoutineToDevice } from "@/browser/export-routine-to-device";
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
  const [working, setWorking] = useState<"pdf" | "text" | null>(null);
  const [preparedState, setPreparedState] = useState<{
    plan: RoutinePlan;
    pdf: PreparedRoutinePdf;
  } | null>(null);
  const preparedPdf = preparedState?.plan === plan ? preparedState.pdf : null;
  const status = statusState?.plan === plan ? statusState.text : null;
  const setStatus = (text: string | null) =>
    setStatusState(text === null ? null : { plan, text });

  const preparePdf = () => {
    setWorking("pdf");
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
      .finally(() => setWorking(null));
  };

  const downloadText = () => {
    const exported = createRoutineTextExport({
      plan,
      catalog,
      origin: window.location.origin,
    });
    setWorking("text");
    setStatus(null);
    void exportRoutineToDevice(exported)
      .then((outcome) => {
        if (outcome === "shared") {
          setStatus("Versión de texto lista para compartir.");
        } else if (outcome === "downloaded") {
          setStatus("Descargamos la versión liviana en TXT.");
        }
      })
      .catch(() =>
        setStatus("No pudimos preparar el archivo. Intentá nuevamente."),
      )
      .finally(() => setWorking(null));
  };

  return (
    <div className={styles.root}>
      <div className={styles.primaryActions}>
        <button
          className="button button-secondary"
          type="button"
          disabled={disabled || working !== null}
          onClick={preparePdf}
        >
          <Download aria-hidden="true" />
          {working === "pdf"
            ? "Creando PDF…"
            : preparedPdf
              ? "Volver a crear PDF"
              : "Exportar PDF"}
        </button>

        {preparedPdf ? (
          <span className={styles.readyActions}>
            <button
              className="button button-primary"
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

      <button
        className={styles.textExport}
        type="button"
        disabled={disabled || working !== null}
        onClick={downloadText}
      >
        <FileText aria-hidden="true" />
        {working === "text" ? "Preparando TXT…" : "Descargar versión TXT"}
      </button>
      {status ? (
        <span className={styles.status} role="status">
          {status}
        </span>
      ) : null}
    </div>
  );
}
