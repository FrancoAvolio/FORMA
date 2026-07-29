"use client";

import {
  BadgeCheck,
  ChevronRight,
  Clock3,
  ExternalLink,
  MessageCircleQuestion,
  Play,
  RefreshCw,
  Save,
  Square,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState } from "react";

import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail";
import { ExportRoutineButton } from "@/components/routines/export-routine-button";
import { SessionBlocks } from "@/components/routines/session-blocks";
import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";
import { exerciseListLabel } from "@/presentation/exercise-labels";

import styles from "./conversation-routine-preview.module.css";

export type ConversationRoutineAction = {
  dayId: string;
  exerciseId: string;
};

export type ConversationRoutinePreviewActions = {
  onSave?: () => void;
  onOpenRoutine?: () => void;
  onExplainRoutine?: () => void;
  onExplainExercise?: (target: ConversationRoutineAction) => void;
  onReplaceExercise?: (target: ConversationRoutineAction) => void;
};

export type ConversationRoutinePreviewProps = {
  /** A plan that has already passed the complete deterministic validator. */
  plan: RoutinePlan;
  catalog: readonly CatalogExercise[] | ReadonlyMap<string, CatalogExercise>;
  media: Readonly<Record<string, ExerciseMedia>> | ReadonlyMap<string, ExerciseMedia>;
  activeDayId: string | null;
  onActiveDayChange: (dayId: string) => void;
  actions?: ConversationRoutinePreviewActions;
  saved?: boolean;
  className?: string;
};

function toExerciseMap(
  catalog: ConversationRoutinePreviewProps["catalog"],
): ReadonlyMap<string, CatalogExercise> {
  return isExerciseMap(catalog)
    ? catalog
    : new Map(catalog.map((exercise) => [exercise.id, exercise]));
}

function isExerciseMap(
  catalog: ConversationRoutinePreviewProps["catalog"],
): catalog is ReadonlyMap<string, CatalogExercise> {
  return !Array.isArray(catalog);
}

function isMediaMap(
  media: ConversationRoutinePreviewProps["media"],
): media is ReadonlyMap<string, ExerciseMedia> {
  return typeof (media as ReadonlyMap<string, ExerciseMedia>).get === "function";
}

function resolveMedia(
  media: ConversationRoutinePreviewProps["media"],
  exerciseId: string,
): ExerciseMedia | undefined {
  return isMediaMap(media) ? media.get(exerciseId) : media[exerciseId];
}

export function ConversationRoutinePreview({
  plan,
  catalog,
  media,
  activeDayId,
  onActiveDayChange,
  actions,
  saved = false,
  className,
}: ConversationRoutinePreviewProps) {
  const previewId = useId();
  const [activeDemonstrationKey, setActiveDemonstrationKey] = useState<
    string | null
  >(null);
  const exercisesById = useMemo(() => toExerciseMap(catalog), [catalog]);
  const activeDay =
    plan.days.find((day) => day.id === activeDayId) ?? plan.days[0];
  const totalMinutes = plan.days.reduce(
    (total, day) => total + day.estimatedMinutes,
    0,
  );
  const totalExercises = plan.days.reduce(
    (total, day) => total + day.exercises.length,
    0,
  );

  if (!activeDay) return null;

  const headingId = `${previewId}-heading`;
  const dayHeadingId = `${previewId}-day-heading`;

  return (
    <section
      className={[styles.preview, className].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Tu semana con FORMA</p>
          <h2 id={headingId}>{plan.title}</h2>
          <p className={styles.summary}>{plan.summary}</p>
        </div>
        <span className={styles.validationBadge} aria-label="Rutina validada">
          <BadgeCheck aria-hidden="true" />
          Validada
        </span>
      </header>

      <dl className={styles.weekSummary} aria-label="Resumen semanal">
        <div>
          <dt>División</dt>
          <dd>{plan.splitName}</dd>
        </div>
        <div>
          <dt>Semana</dt>
          <dd>{plan.daysPerWeek} días</dd>
        </div>
        <div>
          <dt>Tiempo</dt>
          <dd>{totalMinutes} min aprox.</dd>
        </div>
        <div>
          <dt>Ejercicios</dt>
          <dd>{totalExercises} en total</dd>
        </div>
      </dl>

      <div className={styles.dayTabs} role="group" aria-label="Días de la rutina">
        {plan.days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            aria-pressed={day.id === activeDay.id}
            onClick={() => {
              setActiveDemonstrationKey(null);
              onActiveDayChange(day.id);
            }}
          >
            <span>Día {index + 1}</span>
            <small>{day.estimatedMinutes} min</small>
          </button>
        ))}
      </div>

      <article className={styles.day} aria-labelledby={dayHeadingId}>
        <header className={styles.dayHeading}>
          <div>
            <p className={styles.eyebrow}>Día seleccionado</p>
            <h3 id={dayHeadingId}>{activeDay.name}</h3>
            <p>{exerciseListLabel(activeDay.focus)}</p>
          </div>
          <span>
            <Clock3 aria-hidden="true" />
            {activeDay.estimatedMinutes} min · {activeDay.exercises.length} ejercicios
          </span>
        </header>

        <SessionBlocks blocks={activeDay.sessionBlocks} />

        <ol className={styles.exerciseList}>
          {activeDay.exercises.map((prescription, index) => {
            const exercise = exercisesById.get(prescription.exerciseId);
            const exerciseMedia = resolveMedia(media, prescription.exerciseId);
            const name = exercise?.name ?? `Ejercicio ${prescription.exerciseId}`;
            const actionTarget = {
              dayId: activeDay.id,
              exerciseId: prescription.exerciseId,
            };
            const demonstrationKey = `${activeDay.id}:${prescription.exerciseId}`;
            const demonstrationActive =
              activeDemonstrationKey === demonstrationKey;

            return (
              <li key={prescription.exerciseId} className={styles.exerciseCard}>
                <span className={styles.order} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className={styles.media}>
                  {exerciseMedia ? (
                    <ExerciseThumbnail
                      name={name}
                      media={exerciseMedia}
                      animated={demonstrationActive}
                    />
                  ) : (
                    <div className={styles.missingMedia}>
                      Vista previa no disponible
                    </div>
                  )}
                </div>

                <div className={styles.exerciseBody}>
                  <div className={styles.exerciseHeading}>
                    <div>
                      <h4>{name}</h4>
                      {exercise ? (
                        <p>
                          {exerciseListLabel(exercise.primaryMuscles)} ·{" "}
                          {exerciseListLabel(exercise.equipment)}
                        </p>
                      ) : (
                        <p>Ejercicio validado del catálogo local</p>
                      )}
                    </div>
                    <span>RIR {prescription.rir ?? "—"}</span>
                  </div>

                  <dl className={styles.prescription}>
                    <div>
                      <dt>Series</dt>
                      <dd>{prescription.sets}</dd>
                    </div>
                    <div>
                      <dt>Repeticiones</dt>
                      <dd>{prescription.repPrescription}</dd>
                    </div>
                    <div>
                      <dt>Descanso</dt>
                      <dd>{prescription.restSeconds} s</dd>
                    </div>
                  </dl>

                  <details className={styles.reasons}>
                    <summary>Por qué está acá</summary>
                    <ul>
                      {prescription.selectionReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </details>

                  <div className={styles.exerciseActions}>
                    {exerciseMedia?.available && exerciseMedia.animationUrl ? (
                      <button
                        type="button"
                        aria-pressed={demonstrationActive}
                        onClick={() =>
                          setActiveDemonstrationKey((current) =>
                            current === demonstrationKey
                              ? null
                              : demonstrationKey,
                          )
                        }
                      >
                        {demonstrationActive ? (
                          <Square aria-hidden="true" />
                        ) : (
                          <Play aria-hidden="true" />
                        )}
                        {demonstrationActive ? "Detener" : "Ver demostración"}
                      </button>
                    ) : null}
                    <Link href={`/ejercicios/${prescription.exerciseId}`}>
                      <ExternalLink aria-hidden="true" /> Ver ficha
                    </Link>
                    {actions?.onExplainExercise ? (
                      <button
                        type="button"
                        onClick={() => actions.onExplainExercise?.(actionTarget)}
                      >
                        <MessageCircleQuestion aria-hidden="true" /> ¿Por qué este?
                      </button>
                    ) : null}
                    {actions?.onReplaceExercise ? (
                      <button
                        type="button"
                        onClick={() => actions.onReplaceExercise?.(actionTarget)}
                      >
                        <RefreshCw aria-hidden="true" /> Reemplazar
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </article>

      {plan.warnings.length > 0 ? (
        <details className={styles.warnings}>
          <summary>{plan.warnings.length} observaciones del validador</summary>
          <ul>
            {plan.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <footer className={styles.footer}>
        <div>
          {actions?.onExplainRoutine ? (
            <button type="button" onClick={actions.onExplainRoutine}>
              <MessageCircleQuestion aria-hidden="true" /> Preguntar por la rutina
            </button>
          ) : null}
          {actions?.onSave ? (
            <button type="button" onClick={actions.onSave}>
              <Save aria-hidden="true" /> {saved ? "Guardada" : "Guardar"}
            </button>
          ) : null}
          <ExportRoutineButton
            plan={plan}
            catalog={catalog}
            media={media}
            disabled={!actions}
          />
        </div>
        {actions?.onOpenRoutine ? (
          <button className={styles.openRoutine} type="button" onClick={actions.onOpenRoutine}>
            Abrir rutina completa <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
      </footer>
    </section>
  );
}
