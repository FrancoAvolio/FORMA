"use client";

import { ArrowRight, Bookmark, Database, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  createBrowserRoutineRepository,
  type SavedRoutine,
} from "@/persistence";

import styles from "./saved-routines.module.css";

export function SavedRoutines() {
  const router = useRouter();
  const [routines, setRoutines] = useState<SavedRoutine[] | null>(null);

  const reload = useCallback(() => {
    void createBrowserRoutineRepository().list().then(setRoutines);
  }, []);

  useEffect(reload, [reload]);

  const open = async (routine: SavedRoutine) => {
    await createBrowserRoutineRepository().saveCurrentRoutine(
      routine.request,
      routine.plan,
      routine.safetyScreening,
    );
    router.push("/rutina");
  };

  const remove = async (routine: SavedRoutine) => {
    if (!window.confirm("¿Querés borrar esta rutina guardada?")) return;
    await createBrowserRoutineRepository().remove(routine.id);
    reload();
  };

  const clear = async () => {
    if (
      !window.confirm(
        "Esto borra rutinas, borradores, conversación y preferencias guardadas en este navegador. ¿Continuar?",
      )
    ) {
      return;
    }
    await createBrowserRoutineRepository().clear();
    setRoutines([]);
  };

  if (routines === null) {
    return (
      <section className={[styles.loading, "shell"].join(" ")} aria-live="polite">
        <p className="eyebrow">Persistencia local</p>
        <h1>Revisando este navegador…</h1>
      </section>
    );
  }

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">Sin cuenta · sólo en este dispositivo</p>
          <h1>Rutinas guardadas</h1>
          <p>
            FORMA no sube estos planes a una base de datos. Si borrás los datos del navegador,
            también se eliminan de acá.
          </p>
        </div>
        {routines.length > 0 && (
          <button type="button" className="button button-quiet" onClick={() => void clear()}>
            <Trash2 aria-hidden="true" size={17} /> Borrar datos locales
          </button>
        )}
      </header>

      {routines.length === 0 ? (
        <section className={styles.empty}>
          <Bookmark aria-hidden="true" />
          <h2>Todavía no guardaste ninguna rutina.</h2>
          <p>Generá un plan, revisalo y usá la acción “Guardar”.</p>
          <Link className="button button-primary" href="/crear">
            Crear mi rutina
          </Link>
        </section>
      ) : (
        <div className={styles.grid}>
          {routines.map((routine) => (
            <article className={styles.card} key={routine.id}>
              <div className={styles.cardTop}>
                <span>{goalLabel(routine.plan.goal)}</span>
                <Bookmark aria-hidden="true" />
              </div>
              <h2>{routine.plan.title}</h2>
              <p>
                {routine.plan.splitName} · {routine.plan.daysPerWeek} días ·{" "}
                {routine.plan.days.reduce((total, day) => total + day.estimatedMinutes, 0)} min
                semanales
              </p>
              <dl>
                <div>
                  <dt>Actualizada</dt>
                  <dd>{new Date(routine.updatedAt).toLocaleString("es-AR")}</dd>
                </div>
                <div>
                  <dt>Dataset</dt>
                  <dd>{routine.plan.datasetVersion.slice(0, 10)}</dd>
                </div>
                <div>
                  <dt>Motor</dt>
                  <dd>{routine.plan.engineVersion}</dd>
                </div>
              </dl>
              <div className={styles.cardActions}>
                <button type="button" onClick={() => void open(routine)}>
                  Abrir rutina <ArrowRight aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  onClick={() => void remove(routine)}
                  aria-label={"Borrar " + routine.plan.title}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <aside className={styles.storageNote}>
        <Database aria-hidden="true" />
        <div>
          <strong>Esquema de persistencia versionado</strong>
          <p>
            También guarda el borrador actual, el estado estructurado del chat y tu preferencia
            de reproducción de media.
          </p>
        </div>
      </aside>
    </div>
  );
}

function goalLabel(goal: SavedRoutine["plan"]["goal"]): string {
  return {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Acondicionamiento general",
    muscular_endurance: "Resistencia muscular",
  }[goal];
}
