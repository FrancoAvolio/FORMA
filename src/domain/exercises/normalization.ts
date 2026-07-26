import type { MovementPattern } from "./catalog-exercise";

const MUSCLE_ALIASES: Readonly<Record<string, string>> = {
  abdominal: "core",
  abdominals: "core",
  abs: "core",
  abdomen: "core",
  back: "back",
  espalda: "back",
  lat: "back",
  lats: "back",
  latissimus: "back",
  "latissimus dorsi": "back",
  "upper back": "back",
  traps: "back",
  trapezius: "back",
  "levator scapulae": "back",
  spine: "back",
  pectoral: "chest",
  pectorals: "chest",
  pecho: "chest",
  chest: "chest",
  deltoid: "shoulders",
  deltoids: "shoulders",
  delts: "shoulders",
  hombro: "shoulders",
  hombros: "shoulders",
  shoulders: "shoulders",
  bicep: "biceps",
  biceps: "biceps",
  tricep: "triceps",
  triceps: "triceps",
  glute: "glutes",
  gluteos: "glutes",
  "gluteos mayores": "glutes",
  glutes: "glutes",
  hamstring: "hamstrings",
  hamstrings: "hamstrings",
  isquiotibiales: "hamstrings",
  quadricep: "quadriceps",
  quadriceps: "quadriceps",
  quads: "quadriceps",
  cuadriceps: "quadriceps",
  calf: "calves",
  calves: "calves",
  gemelos: "calves",
  pantorrillas: "calves",
  forearm: "forearms",
  forearms: "forearms",
  antebrazos: "forearms",
};

const EQUIPMENT_ALIASES: Readonly<Record<string, string>> = {
  "body weight": "body_weight",
  bodyweight: "body_weight",
  "peso corporal": "body_weight",
  none: "body_weight",
  dumbbell: "dumbbell",
  dumbbells: "dumbbell",
  mancuerna: "dumbbell",
  mancuernas: "dumbbell",
  barbell: "barbell",
  barra: "barbell",
  cable: "cable",
  cables: "cable",
  polea: "cable",
  poleas: "cable",
  machine: "machine",
  machines: "machine",
  maquina: "machine",
  maquinas: "machine",
  "leverage machine": "machine",
  "smith machine": "smith_machine",
  smith: "smith_machine",
  kettlebell: "kettlebell",
  kettlebells: "kettlebell",
  pesa_rusa: "kettlebell",
  "pesa rusa": "kettlebell",
  band: "resistance_band",
  bands: "resistance_band",
  "resistance band": "resistance_band",
  banda: "resistance_band",
  bandas: "resistance_band",
  bench: "bench",
  banco: "bench",
  "pull-up bar": "pull_up_bar",
  "pull up bar": "pull_up_bar",
  "barra de dominadas": "pull_up_bar",
  medicine_ball: "medicine_ball",
  "medicine ball": "medicine_ball",
  "balon medicinal": "medicine_ball",
  stability_ball: "stability_ball",
  "stability ball": "stability_ball",
  roller: "roller",
  rope: "rope",
  weighted: "weighted",
};

const MOVEMENT_PATTERN_ALIASES: Readonly<Record<string, MovementPattern>> = {
  horizontal_push: "horizontal_push",
  "horizontal push": "horizontal_push",
  "empuje horizontal": "horizontal_push",
  vertical_push: "vertical_push",
  "vertical push": "vertical_push",
  "empuje vertical": "vertical_push",
  horizontal_pull: "horizontal_pull",
  "horizontal pull": "horizontal_pull",
  "tiron horizontal": "horizontal_pull",
  "traccion horizontal": "horizontal_pull",
  vertical_pull: "vertical_pull",
  "vertical pull": "vertical_pull",
  "tiron vertical": "vertical_pull",
  "traccion vertical": "vertical_pull",
  squat: "squat",
  sentadilla: "squat",
  hinge: "hinge",
  bisagra: "hinge",
  "bisagra de cadera": "hinge",
  lunge: "lunge",
  estocada: "lunge",
  zancada: "lunge",
  carry: "carry",
  acarreo: "carry",
  core: "core",
  isolation: "isolation",
  aislamiento: "isolation",
  cardio: "cardio",
};

export function normalizeDomainText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMuscle(value: string): string {
  const normalized = normalizeDomainText(value);
  return MUSCLE_ALIASES[normalized] ?? normalized;
}

export function normalizeEquipment(value: string): string {
  const normalized = normalizeDomainText(value);
  return EQUIPMENT_ALIASES[normalized] ?? normalized.replace(/\s+/g, "_");
}

export function normalizeMovementPattern(
  value: string,
): MovementPattern | undefined {
  return MOVEMENT_PATTERN_ALIASES[normalizeDomainText(value)];
}

export function hasTextMatch(
  values: readonly string[],
  queries: readonly string[],
): boolean {
  const normalizedValues = values.map(normalizeDomainText);
  return queries.some((query) => {
    const normalizedQuery = normalizeDomainText(query);
    return normalizedValues.some(
      (value) =>
        value === normalizedQuery ||
        value.includes(normalizedQuery) ||
        normalizedQuery.includes(value),
    );
  });
}
