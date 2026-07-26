import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BadgeCheck, FilterX, Search } from "lucide-react";
import Link from "next/link";

import {
  getExerciseFilterOptions,
  searchExercises,
} from "@/application/exercises";
import { ExerciseThumbnail } from "@/components/exercises/exercise-thumbnail";
import { resolveExerciseMedia } from "@/media/server";
import { exerciseLabel, exerciseListLabel } from "@/presentation/exercise-labels";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Explorar ejercicios",
  description: "Buscá en el catálogo validado de FORMA por músculo, equipo o patrón.",
};

type SearchParameters = Record<string, string | string[] | undefined>;

function first(parameters: SearchParameters, key: string): string {
  const value = parameters[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function pageHref(parameters: SearchParameters, page: number): string {
  const query = new URLSearchParams();
  for (const [key, rawValue] of Object.entries(parameters)) {
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    if (value && key !== "page") query.set(key, value);
  }
  query.set("page", String(page));
  return "/ejercicios?" + query.toString();
}

export default async function ExerciseExplorerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const parameters = await searchParams;
  const options = getExerciseFilterOptions();
  const page = Math.max(1, Number.parseInt(first(parameters, "page") || "1", 10) || 1);
  const limit = 18;
  const result = searchExercises({
    query: first(parameters, "q"),
    muscle: first(parameters, "muscle"),
    bodyPart: first(parameters, "bodyPart"),
    equipment: first(parameters, "equipment"),
    pattern: first(parameters, "pattern"),
    difficulty: first(parameters, "difficulty"),
    approvedOnly: first(parameters, "approval") !== "all",
    mediaOnly: first(parameters, "media") === "available",
    offset: (page - 1) * limit,
    limit,
  });
  const totalPages = Math.max(1, Math.ceil(result.total / result.limit));

  return (
    <div className={[styles.page, "shell"].join(" ")}>
      <header className={styles.heading}>
        <p className="eyebrow">Catálogo local · fuente verificable</p>
        <h1>Explorar ejercicios</h1>
        <p>
          Los resultados vienen únicamente del snapshot fijado del dataset. La aprobación para
          generar rutinas y la disponibilidad de media son filtros independientes.
        </p>
      </header>

      <form className={styles.filters} action="/ejercicios" method="get" role="search">
        <label className={styles.search}>
          <span className="sr-only">Buscar ejercicio, músculo o equipamiento</span>
          <Search aria-hidden="true" size={20} />
          <input
            name="q"
            type="search"
            defaultValue={first(parameters, "q")}
            placeholder="Buscar ejercicio, músculo o equipamiento"
          />
        </label>
        <div className={styles.selects}>
          <FilterSelect
            name="muscle"
            label="Músculo"
            value={first(parameters, "muscle")}
            options={options.muscles}
          />
          <FilterSelect
            name="bodyPart"
            label="Parte del cuerpo"
            value={first(parameters, "bodyPart")}
            options={options.bodyParts}
          />
          <FilterSelect
            name="equipment"
            label="Equipamiento"
            value={first(parameters, "equipment")}
            options={options.equipment}
          />
          <FilterSelect
            name="pattern"
            label="Patrón"
            value={first(parameters, "pattern")}
            options={options.patterns}
          />
          <FilterSelect
            name="difficulty"
            label="Dificultad"
            value={first(parameters, "difficulty")}
            options={options.difficulties}
          />
          <label>
            <span>Aprobación</span>
            <select name="approval" defaultValue={first(parameters, "approval") || "approved"}>
              <option value="approved">Aprobados para rutinas</option>
              <option value="all">Todo el dataset</option>
            </select>
          </label>
          <label>
            <span>Media</span>
            <select name="media" defaultValue={first(parameters, "media") || "all"}>
              <option value="all">Con o sin media</option>
              <option value="available">Con referencia de media</option>
            </select>
          </label>
        </div>
        <div className={styles.filterActions}>
          <button className="button button-primary" type="submit">
            Aplicar filtros
          </button>
          <Link className="button button-quiet" href="/ejercicios">
            <FilterX aria-hidden="true" size={17} /> Limpiar
          </Link>
        </div>
      </form>

      <div className={styles.resultHeading} aria-live="polite">
        <p>
          <strong>{result.total.toLocaleString("es-AR")}</strong>{" "}
          {result.total === 1 ? "ejercicio encontrado" : "ejercicios encontrados"}
        </p>
        <span>
          Página {Math.min(page, totalPages)} de {totalPages}
        </span>
      </div>

      {result.exercises.length > 0 ? (
        <div className={styles.grid}>
          {result.exercises.map((exercise, index) => {
            const name = exercise.displayNameEs ?? exercise.displayName;
            return (
              <article className={styles.exerciseCard} key={exercise.id}>
                <ExerciseThumbnail
                  name={name}
                  media={resolveExerciseMedia(exercise.id)}
                  priority={index < 3}
                />
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span>{exerciseLabel(exercise.difficulty)}</span>
                    {exercise.approvedForGeneration && (
                      <span className={styles.approved}>
                        <BadgeCheck aria-hidden="true" size={14} /> Aprobado
                      </span>
                    )}
                  </div>
                  <h2>{name}</h2>
                  <p>
                    {exerciseListLabel(exercise.primaryMuscles)} ·{" "}
                    {exerciseLabel(exercise.equipment)}
                  </p>
                  <Link href={"/ejercicios/" + exercise.id}>
                    Ver técnica <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          <Search aria-hidden="true" />
          <h2>No encontramos coincidencias</h2>
          <p>Probá con un músculo más general o quitá uno de los filtros.</p>
          <Link className="button button-secondary" href="/ejercicios">
            Ver todo el catálogo
          </Link>
        </div>
      )}

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Páginas de resultados">
          {page > 1 ? (
            <Link href={pageHref(parameters, page - 1)}>
              <ArrowLeft aria-hidden="true" /> Anterior
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages && (
            <Link href={pageHref(parameters, page + 1)}>
              Siguiente <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
}) {
  return (
    <label>
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {exerciseLabel(option)}
          </option>
        ))}
      </select>
    </label>
  );
}
