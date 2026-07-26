import type { Metadata } from "next";
import { ClipboardList, MessageCircleOff } from "lucide-react";
import Link from "next/link";

import { RoutineChat } from "@/components/chat/routine-chat";
import { EXERCISE_DATASET_COMMIT } from "@/data/catalog";
import { getRoutineCatalog } from "@/data/routine-catalog";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Chat para crear rutina",
  description: "Interpretación conversacional opcional sobre el mismo motor validado de FORMA.",
};

export const dynamic = "force-dynamic";

export default function RoutineChatPage() {
  const provider =
    process.env.AI_PROVIDER ??
    (process.env.NODE_ENV === "production" ? "cloudflare" : "ollama");

  if (provider === "disabled") {
    return (
      <div className={[styles.disabledPage, "shell"].join(" ")}>
        <section className="card" aria-labelledby="disabled-ai-title">
          <MessageCircleOff aria-hidden="true" />
          <p className="eyebrow">Asistente opcional desactivado</p>
          <h1 id="disabled-ai-title">Creá la misma rutina sin IA.</h1>
          <p className={styles.description}>
            El formulario guiado produce exactamente el mismo contrato validado y usa el
            mismo motor determinista. El catálogo, la generación y tus rutinas guardadas
            siguen disponibles.
          </p>
          <Link className="button button-primary" href="/crear">
            <ClipboardList aria-hidden="true" /> Continuar con el formulario
          </Link>
        </section>
      </div>
    );
  }

  return (
    <RoutineChat
      catalog={getRoutineCatalog()}
      datasetVersion={EXERCISE_DATASET_COMMIT}
    />
  );
}
