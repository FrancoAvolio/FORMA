"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  Bookmark,
  Check,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  Pencil,
  Play,
  RefreshCw,
  Repeat2,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  editRoutineExercisePrescription,
  findRoutineExerciseSubstitutions,
  regenerateRoutineDay,
  removeRoutineExercise,
  reorderRoutineExercise,
  replaceRoutineExercise,
  type RoutineMutationResult,
} from "@/application/routines";
import { deriveAssistantSafetyResult } from "@/application/conversation";
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail";
import { LazyExportRoutineButton } from "@/components/routines/lazy-export-routine-button";
import { SessionBlocks } from "@/components/routines/session-blocks";
import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import { rirToRpe } from "@/domain/routine/engine/assign-prescription";
import type { RoutineExercise, RoutinePlan } from "@/domain/routine/schemas";
import { validateRoutine } from "@/domain/routine/validators/validate-routine";
import type { ExerciseMedia } from "@/media";
import {
  createBrowserRoutineRepository,
  type CurrentRoutine,
} from "@/persistence";
import { exerciseLabel, exerciseListLabel } from "@/presentation/exercise-labels";

import styles from "./routine-viewer.module.css";

type ReplacementState = {
  dayId: string;
  exerciseId: string;
  options: CatalogExercise[];
};

export function RoutineViewer({
  catalog,
  media,
}: {
  catalog: readonly CatalogExercise[];
  media: Readonly<Record<string, ExerciseMedia>>;
}) {
  const [current, setCurrent] = useState<CurrentRoutine | null | undefined>(undefined);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [replacement, setReplacement] = useState<ReplacementState | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [safetyBlocked, setSafetyBlocked] = useState(false);
  const [activeDemonstrationKey, setActiveDemonstrationKey] = useState<
    string | null
  >(null);
  const byId = useMemo(
    () => new Map(catalog.map((exercise) => [exercise.id, exercise])),
    [catalog],
  );

  useEffect(() => {
    const repository = createBrowserRoutineRepository();
    void Promise.all([
      repository.loadCurrentRoutine(),
      repository.loadRoutineConversationState(),
    ]).then(([loaded, conversation]) => {
        const assistantSafety = deriveAssistantSafetyResult(
          conversation.limitationsConfirmation,
          conversation.safety.signals,
          conversation.safety.result,
        );
        setSafetyBlocked(Boolean(loaded && !assistantSafety.generationAllowed));
        setCurrent(loaded);
        setActiveDayId(loaded?.plan.days[0]?.id ?? null);
      });
  }, []);

  const validation = useMemo(
    () =>
      current
        ? validateRoutine(
            current.plan,
            current.request,
            catalog,
            current.safetyScreening,
          )
        : null,
    [catalog, current],
  );

  if (current === undefined) {
    return (
      <div className={[styles.loading, "shell"].join(" ")} aria-live="polite">
        <p className="eyebrow">Persistencia local</p>
        <h1>Cargando tu rutina…</h1>
      </div>
    );
  }

  if (!current) {
    return (
      <section className={[styles.empty, "shell"].join(" ")}>
        <Bookmark aria-hidden="true" />
        <p className="eyebrow">Sin rutina activa</p>
        <h1>Primero armemos un plan.</h1>
        <p>
          Completá el formulario guiado o abrí una rutina que ya guardaste en este navegador.
        </p>
        <div>
          <Link className="button button-primary" href="/crear">
            Crear mi rutina
          </Link>
          <Link className="button button-secondary" href="/guardadas">
            Ver guardadas
          </Link>
        </div>
      </section>
    );
  }

  const activeDay =
    current.plan.days.find((day) => day.id === activeDayId) ?? current.plan.days[0];
  const totalMinutes = current.plan.days.reduce(
    (total, day) => total + day.estimatedMinutes,
    0,
  );

  const persistMutation = async (result: RoutineMutationResult) => {
    if (safetyBlocked) {
      setMessage({
        kind: "error",
        text: "Las acciones están pausadas hasta completar la revisión de seguridad.",
      });
      return;
    }
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message });
      return;
    }
    const next = await createBrowserRoutineRepository().saveCurrentRoutine(
      current.request,
      result.plan,
      current.safetyScreening,
    );
    setCurrent(next);
    setReplacement(null);
    setActiveDemonstrationKey(null);
    setSaved(false);
    setMessage({ kind: "success", text: "Cambio aplicado y rutina revalidada." });
  };

  const common = {
    plan: current.plan,
    request: current.request,
    safetyScreening: current.safetyScreening,
    catalog,
  };

  const save = async () => {
    if (safetyBlocked) return;
    await createBrowserRoutineRepository().save(
      current.request,
      current.plan,
      current.safetyScreening,
    );
    setSaved(true);
    setMessage({ kind: "success", text: "Rutina guardada en este navegador." });
  };

  const duplicate = async () => {
    if (safetyBlocked) return;
    const copy: RoutinePlan = {
      ...current.plan,
      id: "routine-copy-" + crypto.randomUUID(),
      title: current.plan.title + " · copia",
      assumptions: [
        ...current.plan.assumptions,
        "Esta rutina es una copia local de un plan previamente validado.",
      ],
    };
    await createBrowserRoutineRepository().save(
      current.request,
      copy,
      current.safetyScreening,
    );
    const next = await createBrowserRoutineRepository().saveCurrentRoutine(
      current.request,
      copy,
      current.safetyScreening,
    );
    setCurrent(next);
    setActiveDayId(copy.days[0]?.id ?? null);
    setActiveDemonstrationKey(null);
    setSaved(true);
    setMessage({ kind: "success", text: "Copia creada y guardada." });
  };

  const openReplacement = (dayId: string, exerciseId: string) => {
    const options = findRoutineExerciseSubstitutions({
      ...common,
      dayId,
      exerciseId,
      seed: crypto.randomUUID(),
      limit: 6,
    });
    setReplacement({ dayId, exerciseId, options });
    if (options.length === 0) {
      setMessage({
        kind: "error",
        text: "No hay una sustitución compatible y aprobada para este ejercicio.",
      });
    }
  };

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <div>
          <p className="eyebrow">
            {goalLabel(current.plan.goal)} · {current.plan.daysPerWeek} días por semana
          </p>
          <h1>{current.plan.title}</h1>
          <p>{current.plan.summary}</p>
        </div>
        <div className={styles.headingActions}>
          <Link className="button button-quiet" href="/crear">
            <Pencil aria-hidden="true" size={17} /> Editar perfil
          </Link>
          <LazyExportRoutineButton
            plan={current.plan}
            catalog={catalog}
            media={media}
            disabled={safetyBlocked}
          />
          <button className="button button-primary" type="button" onClick={() => void save()} disabled={safetyBlocked}>
            {saved ? <Check aria-hidden="true" size={17} /> : <Save aria-hidden="true" size={17} />}
            {saved ? "Guardada" : "Guardar"}
          </button>
        </div>
      </header>

      {safetyBlocked ? (
        <div className={styles.errorMessage} role="status">
          <CircleAlert aria-hidden="true" />
          <span>
            Rutina conservada como referencia. Guardar, modificar y reemplazar
            están pausados hasta revisar las señales de seguridad en el formulario.
          </span>
        </div>
      ) : null}

      <section className={styles.summary} aria-label="Resumen de la rutina">
        <div>
          <span>División</span>
          <strong>{current.plan.splitName}</strong>
        </div>
        <div>
          <span>Tiempo semanal</span>
          <strong>{totalMinutes} min aprox.</strong>
        </div>
        <div>
          <span>Versión del motor</span>
          <strong>{current.plan.engineVersion}</strong>
        </div>
      </section>

      {message && (
        <div
          className={message.kind === "error" ? styles.errorMessage : styles.successMessage}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.kind === "error" ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            <BadgeCheck aria-hidden="true" />
          )}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Cerrar mensaje">
            ×
          </button>
        </div>
      )}

      <div className={styles.dayTabs} role="tablist" aria-label="Días de entrenamiento">
        {current.plan.days.map((day, index) => (
          <button
            key={day.id}
            type="button"
            role="tab"
            aria-selected={day.id === activeDay?.id}
            onClick={() => {
              setActiveDemonstrationKey(null);
              setActiveDayId(day.id);
            }}
          >
            Día {index + 1}
          </button>
        ))}
      </div>

      {activeDay && (
        <section className={styles.day} aria-labelledby="active-day-title">
          <header className={styles.dayHeading}>
            <div>
              <h2 id="active-day-title">{activeDay.name}</h2>
              <p>{exerciseListLabel(activeDay.focus)}</p>
            </div>
            <span>
              <Clock3 aria-hidden="true" /> {activeDay.estimatedMinutes} min ·{" "}
              {activeDay.exercises.length} ejercicios
            </span>
            <button
              type="button"
              className="button button-quiet"
              disabled={safetyBlocked}
              onClick={() =>
                void persistMutation(
                  regenerateRoutineDay({
                    ...common,
                    dayId: activeDay.id,
                    seed: crypto.randomUUID(),
                  }),
                )
              }
            >
              <RefreshCw aria-hidden="true" size={16} /> Regenerar este día
            </button>
          </header>

          <SessionBlocks blocks={activeDay.sessionBlocks} />

          <ol className={styles.exerciseList}>
            {activeDay.exercises.map((prescribed, index) => {
              const exercise = byId.get(prescribed.exerciseId);
              if (!exercise) return null;
              const exerciseMedia = media[exercise.id];
              const demonstrationKey = `${activeDay.id}:${exercise.id}`;
              const demonstrationActive =
                activeDemonstrationKey === demonstrationKey;
              return (
                <li key={exercise.id} className={styles.exerciseCard}>
                  <div className={styles.orderControls} aria-label={"Orden de " + exercise.name}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      disabled={safetyBlocked || index === 0}
                      onClick={() =>
                        void persistMutation(
                          reorderRoutineExercise({
                            ...common,
                            dayId: activeDay.id,
                            fromIndex: index,
                            toIndex: index - 1,
                          }),
                        )
                      }
                      aria-label={"Mover " + exercise.name + " hacia arriba"}
                    >
                      <ArrowUp aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={safetyBlocked || index === activeDay.exercises.length - 1}
                      onClick={() =>
                        void persistMutation(
                          reorderRoutineExercise({
                            ...common,
                            dayId: activeDay.id,
                            fromIndex: index,
                            toIndex: index + 1,
                          }),
                        )
                      }
                      aria-label={"Mover " + exercise.name + " hacia abajo"}
                    >
                      <ArrowDown aria-hidden="true" />
                    </button>
                  </div>
                  {exerciseMedia && (
                    <div className={styles.exerciseImage}>
                      <ExerciseThumbnail
                        name={exercise.name}
                        media={exerciseMedia}
                        animated={demonstrationActive}
                      />
                    </div>
                  )}
                  <div className={styles.exerciseContent}>
                    <div className={styles.exerciseTitle}>
                      <div>
                        <h3>{exercise.name}</h3>
                        <p>
                          {exerciseListLabel(exercise.primaryMuscles)} ·{" "}
                          {exercise.equipment.map(exerciseLabel).join(", ")}
                        </p>
                      </div>
                      <span>RIR {prescribed.rir ?? "—"}</span>
                    </div>

                    <div className={styles.prescription}>
                      <span>
                        <strong>{prescribed.sets}</strong> series
                      </span>
                      <span>
                        <strong>{prescribed.repPrescription}</strong> reps
                      </span>
                      <span>
                        <strong>{prescribed.restSeconds}</strong> s descanso
                      </span>
                      <span>
                        <strong>
                          {prescribed.rir === null ? "—" : rirToRpe(prescribed.rir)}
                        </strong>{" "}
                        RPE derivado
                      </span>
                    </div>

                    <details className={styles.reasons}>
                      <summary>Por qué está acá</summary>
                      <ul>
                        {prescribed.selectionReasons.map((reason) => (
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
                            setActiveDemonstrationKey((currentKey) =>
                              currentKey === demonstrationKey
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
                      <Link href={"/ejercicios/" + exercise.id}>
                        <ExternalLink aria-hidden="true" /> Ver ficha
                      </Link>
                      <button
                        type="button"
                        disabled={safetyBlocked}
                        onClick={() => openReplacement(activeDay.id, exercise.id)}
                      >
                        <Repeat2 aria-hidden="true" /> Reemplazar
                      </button>
                      <PrescriptionEditor
                        prescribed={prescribed}
                        disabled={safetyBlocked}
                        onApply={(patch) =>
                          void persistMutation(
                            editRoutineExercisePrescription({
                              ...common,
                              dayId: activeDay.id,
                              exerciseId: exercise.id,
                              patch,
                            }),
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.remove}
                        disabled={safetyBlocked}
                        onClick={() => {
                          if (!window.confirm("¿Querés quitar este ejercicio del día?")) return;
                          void persistMutation(
                            removeRoutineExercise({
                              ...common,
                              dayId: activeDay.id,
                              exerciseId: exercise.id,
                            }),
                          );
                        }}
                      >
                        <Trash2 aria-hidden="true" /> Quitar
                      </button>
                    </div>

                    {replacement?.dayId === activeDay.id &&
                      replacement.exerciseId === exercise.id && (
                        <div className={styles.replacements}>
                          <div>
                            <strong>Elegí una sustitución</strong>
                            <button
                              type="button"
                              onClick={() => setReplacement(null)}
                              aria-label="Cerrar sustituciones"
                            >
                              ×
                            </button>
                          </div>
                          {replacement.options.length > 0 ? (
                            <ul>
                              {replacement.options.map((option) => (
                                <li key={option.id}>
                                  <button
                                    type="button"
                                    disabled={safetyBlocked}
                                    onClick={() =>
                                      void persistMutation(
                                        replaceRoutineExercise({
                                          ...common,
                                          dayId: activeDay.id,
                                          exerciseId: exercise.id,
                                          replacementExerciseId: option.id,
                                          seed: crypto.randomUUID(),
                                        }),
                                      )
                                    }
                                  >
                                    <span>{option.name}</span>
                                    <small>
                                      {exerciseListLabel(option.primaryMuscles)} ·{" "}
                                      {option.equipment.map(exerciseLabel).join(", ")}
                                    </small>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>No encontramos opciones compatibles.</p>
                          )}
                        </div>
                      )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section
        className={validation?.valid ? styles.validation : styles.validationError}
        aria-labelledby="validation-title"
      >
        {validation?.valid ? (
          <BadgeCheck aria-hidden="true" />
        ) : (
          <CircleAlert aria-hidden="true" />
        )}
        <div>
          <h2 id="validation-title">
            {validation?.valid ? "Rutina validada" : "La rutina necesita revisión"}
          </h2>
          <p>
            {validation?.valid
              ? "No contiene errores deterministas de seguridad, equipamiento, volumen o duración."
              : "Uno o más cambios no cumplen las reglas del motor."}
          </p>
          {validation && validation.warnings.length > 0 && (
            <ul>
              {validation.warnings.map((warning) => (
                <li key={warning.code + warning.message}>{warning.message}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className={styles.notesGrid}>
        <section>
          <p className="eyebrow">Suposiciones del plan</p>
          <h2>Qué tomó como cierto el motor</h2>
          <ul>
            {current.plan.assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
        <section>
          <p className="eyebrow">Trazabilidad</p>
          <h2>Versiones reproducibles</h2>
          <dl>
            <div>
              <dt>Dataset</dt>
              <dd>{current.plan.datasetVersion.slice(0, 12)}</dd>
            </div>
            <div>
              <dt>Motor</dt>
              <dd>{current.plan.engineVersion}</dd>
            </div>
            <div>
              <dt>Generada</dt>
              <dd>{new Date(current.plan.generatedAt).toLocaleString("es-AR")}</dd>
            </div>
          </dl>
        </section>
      </div>

      <footer className={styles.footerActions}>
        <button className="button button-secondary" type="button" onClick={() => void duplicate()} disabled={safetyBlocked}>
          <Copy aria-hidden="true" size={17} /> Duplicar rutina
        </button>
        <Link className="button button-quiet" href="/crear/chat">
          <ArrowLeft aria-hidden="true" size={17} /> Volver al chat
        </Link>
      </footer>
    </div>
  );
}

function PrescriptionEditor({
  prescribed,
  onApply,
  disabled = false,
}: {
  prescribed: RoutineExercise;
  onApply: (patch: {
    sets: number;
    repPrescription: string;
    restSeconds: number;
    rir: number | null;
  }) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(prescribed.sets);
  const [repetitions, setRepetitions] = useState(prescribed.repPrescription);
  const [rest, setRest] = useState(prescribed.restSeconds);
  const [rir, setRir] = useState(prescribed.rir ?? 2);

  if (!open) {
    return (
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}>
        <Pencil aria-hidden="true" /> Editar series
      </button>
    );
  }

  return (
    <div className={styles.editor}>
      <label>
        Series
        <input
          type="number"
          min={1}
          max={6}
          value={sets}
          onChange={(event) => setSets(Number(event.target.value))}
        />
      </label>
      <label>
        Repeticiones
        <input value={repetitions} onChange={(event) => setRepetitions(event.target.value)} />
      </label>
      <label>
        Descanso
        <input
          type="number"
          min={30}
          max={300}
          step={15}
          value={rest}
          onChange={(event) => setRest(Number(event.target.value))}
        />
      </label>
      <label>
        RIR
        <input
          type="number"
          min={0}
          max={5}
          value={rir}
          onChange={(event) => setRir(Number(event.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onApply({ sets, repPrescription: repetitions, restSeconds: rest, rir });
          setOpen(false);
        }}
      >
        Aplicar
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Cancelar
      </button>
    </div>
  );
}

function goalLabel(goal: RoutinePlan["goal"]): string {
  return {
    hypertrophy: "Hipertrofia",
    strength: "Fuerza",
    general_fitness: "Acondicionamiento general",
    muscular_endurance: "Resistencia muscular",
  }[goal];
}
