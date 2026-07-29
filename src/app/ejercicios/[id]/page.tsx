import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BadgeCheck, CircleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExerciseMediaViewer } from "@/components/exercises/exercise-media-viewer";
import { RoutinePlacement } from "@/components/exercises/routine-placement";
import { getExerciseDetailById } from "@/data/details";
import { getRoutineCatalog } from "@/data/routine-catalog";
import { resolveExerciseMedia } from "@/media/server";
import {
  exerciseLabel,
  exerciseListLabel,
} from "@/presentation/exercise-labels";

import styles from "./page.module.css";

type PageParameters = { id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParameters>;
}): Promise<Metadata> {
  const { id } = await params;
  const exercise = getExerciseDetailById(id);
  return exercise
    ? {
        title: exercise.displayNameEs ?? exercise.displayName,
        description: exercise.instructionsEs.slice(0, 155),
      }
    : { title: "Ejercicio no encontrado" };
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<PageParameters>;
}) {
  const { id } = await params;
  const exercise = getExerciseDetailById(id);
  if (!exercise) notFound();

  const routineCatalog = getRoutineCatalog();
  const approvedExercise = routineCatalog.find(
    (item) => item.id === exercise.id,
  );
  const substitutions = approvedExercise
    ? routineCatalog
        .filter(
          (item) =>
            item.id !== approvedExercise.id &&
            item.substitutionGroup === approvedExercise.substitutionGroup,
        )
        .slice(0, 6)
    : [];
  const name = exercise.displayNameEs ?? exercise.displayName;

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <Link className={styles.back} href="/ejercicios">
        <ArrowLeft aria-hidden="true" size={17} /> Volver al catálogo
      </Link>

      <header className={styles.heading}>
        <div>
          <p className="eyebrow">
            {exerciseLabel(exercise.bodyPart)} ·{" "}
            {exerciseListLabel(exercise.requiredEquipment)}
          </p>
          <h1>{name}</h1>
          <p className={styles.sourceName}>
            Nombre de origen: {exercise.sourceName}
          </p>
        </div>
        <span
          className={
            exercise.approvedForGeneration ? styles.approved : styles.unreviewed
          }
        >
          {exercise.approvedForGeneration ? (
            <BadgeCheck aria-hidden="true" />
          ) : (
            <CircleAlert aria-hidden="true" />
          )}
          {exercise.approvedForGeneration
            ? "Aprobado para rutinas"
            : "Disponible sólo para explorar"}
        </span>
      </header>

      <div className={styles.mainGrid}>
        <ExerciseMediaViewer
          name={name}
          media={resolveExerciseMedia(exercise.id)}
        />

        <section className={styles.facts} aria-labelledby="facts-title">
          <p className="eyebrow">Ficha técnica</p>
          <h2 id="facts-title">Clasificación</h2>
          <dl>
            <Fact
              label="Músculo principal"
              value={exerciseListLabel(exercise.primaryMuscles)}
            />
            <Fact
              label="Músculos secundarios"
              value={exerciseListLabel(exercise.secondaryMuscles)}
            />
            <Fact
              label="Equipamiento requerido"
              value={exerciseListLabel(exercise.requiredEquipment)}
            />
            <Fact
              label="Parte del cuerpo"
              value={exerciseLabel(exercise.bodyPart)}
            />
            <Fact
              label="Patrón"
              value={exerciseLabel(exercise.movementPattern)}
            />
            <Fact
              label="Dificultad"
              value={exerciseLabel(exercise.difficulty)}
            />
            <Fact label="Tipo" value={exerciseLabel(exercise.modality)} />
            <Fact
              label="Lateralidad"
              value={exerciseLabel(exercise.laterality)}
            />
          </dl>
        </section>
      </div>

      <section
        className={styles.instructions}
        aria-labelledby="instructions-title"
      >
        <p className="eyebrow">Técnica del dataset</p>
        <h2 id="instructions-title">Cómo realizarlo</h2>
        <p>{exercise.instructionsEs}</p>
        {exercise.instructionStepsEs.length > 1 && (
          <ol>
            {exercise.instructionStepsEs.map((step: string, index: number) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.lowerGrid}>
        <section className={styles.placement} aria-labelledby="placement-title">
          <p className="eyebrow">Tu plan local</p>
          <h2 id="placement-title">Ubicación en la rutina</h2>
          <RoutinePlacement exerciseId={exercise.id} />
        </section>

        <section
          className={styles.substitutions}
          aria-labelledby="substitution-title"
        >
          <p className="eyebrow">Mismo grupo funcional</p>
          <h2 id="substitution-title">Sustituciones aprobadas</h2>
          {substitutions.length > 0 ? (
            <ul>
              {substitutions.map((substitution) => (
                <li key={substitution.id}>
                  <Link href={"/ejercicios/" + substitution.id}>
                    <span>{substitution.name}</span>
                    <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No hay sustituciones curadas para este ejercicio. FORMA no va a
              inventar una alternativa fuera del catálogo aprobado.
            </p>
          )}
        </section>
      </div>

      <aside
        className={styles.attribution}
        aria-label="Atribución del ejercicio"
      >
        <p>
          <strong>Datos:</strong> {exercise.sourceAttribution}. Texto sujeto a
          la licencia MIT del repositorio fuente.
        </p>
        <p>
          <strong>Media:</strong>{" "}
          {exercise.sourceMedia?.attribution ??
            "Sin referencia de media en el registro fuente."}{" "}
          La media está sujeta a una licencia separada. Este despliegue usa la
          copia original por decisión explícita del propietario de esta
          aplicación para un uso personal limitado; no representa permiso de Gym
          Visual.
        </p>
        <Link href="/atribuciones">Ver condiciones y auditoría</Link>
      </aside>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
