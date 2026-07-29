import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import type { RoutinePlan } from "@/domain/routine/schemas";

export type RoutineExportCatalog =
  | readonly CatalogExercise[]
  | ReadonlyMap<string, CatalogExercise>;

export type RoutineTextExport = {
  filename: string;
  text: string;
  title: string;
};

function toExerciseMap(
  catalog: RoutineExportCatalog,
): ReadonlyMap<string, CatalogExercise> {
  return Array.isArray(catalog)
    ? new Map(catalog.map((exercise) => [exercise.id, exercise]))
    : (catalog as ReadonlyMap<string, CatalogExercise>);
}

function normalizedOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/u, "");
}

function safeFilenamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 64);
}

export function routineExportFilename(plan: RoutinePlan): string {
  return `forma-${safeFilenamePart(plan.title) || "rutina"}.txt`;
}

export function createRoutineTextExport({
  plan,
  catalog,
  origin,
}: {
  plan: RoutinePlan;
  catalog: RoutineExportCatalog;
  origin: string;
}): RoutineTextExport {
  const exercisesById = toExerciseMap(catalog);
  const baseUrl = normalizedOrigin(origin);
  const totalMinutes = plan.days.reduce(
    (total, day) => total + day.estimatedMinutes,
    0,
  );
  const lines = [
    "FORMA · RUTINA VALIDADA",
    plan.title,
    "",
    `División: ${plan.splitName}`,
    `Frecuencia: ${plan.daysPerWeek} días por semana`,
    `Tiempo semanal estimado: ${totalMinutes} minutos`,
    `Motor: ${plan.engineVersion}`,
    `Dataset: ${plan.datasetVersion}`,
    "",
  ];

  plan.days.forEach((day, dayIndex) => {
    lines.push(
      `DÍA ${dayIndex + 1} · ${day.name.toUpperCase()}`,
      `Duración estimada: ${day.estimatedMinutes} minutos`,
      `Foco: ${day.focus.join(", ")}`,
      "",
    );

    if (day.sessionBlocks && day.sessionBlocks.length > 0) {
      lines.push(
        "Preparación y cierre (incluidos en la duración):",
        ...day.sessionBlocks.map(
          (block) =>
            `- ${block.title}: ${block.estimatedMinutes} min · ${block.description}`,
        ),
        "",
      );
    }

    day.exercises.forEach((prescription, exerciseIndex) => {
      const exercise = exercisesById.get(prescription.exerciseId);
      const name = exercise?.name ?? `Ejercicio ${prescription.exerciseId}`;
      lines.push(
        `${exerciseIndex + 1}. ${name}`,
        `   ${prescription.sets} series · ${prescription.repPrescription} repeticiones · ${prescription.restSeconds} s de descanso · RIR ${prescription.rir ?? "—"}`,
      );
      if (prescription.notes.length > 0) {
        lines.push(`   Nota: ${prescription.notes.join(" ")}`);
      }
      if (baseUrl) {
        lines.push(
          `   Ficha: ${baseUrl}/ejercicios/${encodeURIComponent(prescription.exerciseId)}`,
        );
      }
      lines.push("");
    });
  });

  if (plan.warnings.length > 0) {
    lines.push("OBSERVACIONES", ...plan.warnings.map((warning) => `- ${warning}`), "");
  }
  if (plan.assumptions.length > 0) {
    lines.push(
      "SUPOSICIONES DEL PLAN",
      ...plan.assumptions.map((assumption) => `- ${assumption}`),
      "",
    );
  }
  if (baseUrl) lines.push(`Fuentes y atribuciones: ${baseUrl}/atribuciones`);
  lines.push(
    "FORMA es una herramienta educativa y no reemplaza indicaciones médicas o profesionales.",
  );

  return {
    filename: routineExportFilename(plan),
    text: `${lines.join("\n").trim()}\n`,
    title: plan.title,
  };
}
