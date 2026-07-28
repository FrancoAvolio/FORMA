/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CatalogExercise } from "@/domain/exercises/catalog-exercise";
import type { RoutinePlan } from "@/domain/routine/schemas";
import type { ExerciseMedia } from "@/media";

import { ConversationRoutinePreview } from "./conversation-routine-preview";

vi.mock("next/image", () => ({
  default: (properties: ImgHTMLAttributes<HTMLImageElement>) => (
    // The test intentionally reduces Next Image to its semantic output.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...properties} alt={properties.alt ?? ""} />
  ),
}));

afterEach(cleanup);

const catalog: readonly CatalogExercise[] = [
  {
    id: "press-01",
    name: "Press inclinado con mancuernas",
    aliases: [],
    bodyPart: "chest",
    equipment: ["dumbbell", "bench"],
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
    movementPattern: "horizontal_push",
    modality: "compound",
    laterality: "bilateral",
    difficulty: "intermediate",
    fatigueCost: "medium",
    skillRequirement: "medium",
    defaultRepRange: [8, 12],
    defaultRestSeconds: [90, 120],
    substitutionGroup: "incline-press",
    tags: ["chest"],
    approvedForGeneration: true,
  },
  {
    id: "row-01",
    name: "Remo sentado en polea",
    aliases: [],
    bodyPart: "back",
    equipment: ["cable"],
    primaryMuscles: ["back"],
    secondaryMuscles: ["biceps"],
    movementPattern: "horizontal_pull",
    modality: "compound",
    laterality: "bilateral",
    difficulty: "beginner",
    fatigueCost: "low",
    skillRequirement: "low",
    defaultRepRange: [8, 12],
    defaultRestSeconds: [75, 120],
    substitutionGroup: "row",
    tags: ["back"],
    approvedForGeneration: true,
  },
];

const plan: RoutinePlan = {
  id: "routine-preview-test",
  title: "Hipertrofia · cuatro días",
  goal: "hypertrophy",
  daysPerWeek: 2,
  summary: "Una semana equilibrada con prioridad en torso.",
  splitId: "upper-lower",
  splitName: "Torso / Piernas",
  days: [
    {
      id: "day-upper",
      name: "Torso A",
      focus: ["chest", "back"],
      estimatedMinutes: 55,
      exercises: [
        {
          exerciseId: "press-01",
          sets: 3,
          repPrescription: "8–12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: [],
          selectionReasons: ["Prioriza pecho con el equipamiento disponible."],
        },
      ],
    },
    {
      id: "day-pull",
      name: "Espalda B",
      focus: ["back", "biceps"],
      estimatedMinutes: 45,
      exercises: [
        {
          exerciseId: "row-01",
          sets: 4,
          repPrescription: "8–12",
          restSeconds: 90,
          rir: 2,
          tempo: null,
          notes: [],
          selectionReasons: ["Aporta tracción horizontal de fatiga baja."],
        },
      ],
    },
  ],
  warnings: [],
  assumptions: ["Se usa equipamiento de gimnasio comercial."],
  generatedAt: "2026-07-28T12:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "test",
  seed: "preview-test",
};

const availableMedia: ExerciseMedia = {
  exerciseId: "press-01",
  available: true,
  thumbnailUrl: "/api/exercise-media/images/press-01.jpg",
  animationUrl: "/api/exercise-media/videos/press-01.gif",
  width: 180,
  height: 180,
  attribution: "© Gym Visual — https://gymvisual.com/",
  protectedMedia: true,
  unavailableReason: null,
};

const placeholderMedia: ExerciseMedia = {
  exerciseId: "row-01",
  available: false,
  thumbnailUrl: "/exercises/placeholders/exercise-media.svg",
  animationUrl: null,
  width: 180,
  height: 180,
  attribution: null,
  protectedMedia: false,
  unavailableReason: "disabled_by_configuration",
};

describe("ConversationRoutinePreview", () => {
  it("shows a validated weekly summary and attributed media for the active day", () => {
    render(
      <ConversationRoutinePreview
        plan={plan}
        catalog={catalog}
        media={{ "press-01": availableMedia, "row-01": placeholderMedia }}
        activeDayId="day-upper"
        onActiveDayChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Rutina validada")).toBeVisible();
    expect(screen.getByText("Torso / Piernas")).toBeVisible();
    expect(screen.getByText("100 min aprox.")).toBeVisible();
    expect(screen.getByText("Press inclinado con mancuernas")).toBeVisible();
    expect(screen.getByText("3")).toBeVisible();
    expect(screen.getByText("8–12")).toBeVisible();
    expect(
      screen.getByText("© Gym Visual — https://gymvisual.com/"),
    ).toBeVisible();
    expect(screen.queryByText("Remo sentado en polea")).not.toBeInTheDocument();
  });

  it("delegates day selection and contextual actions without mutating the plan", async () => {
    const user = userEvent.setup();
    const onActiveDayChange = vi.fn();
    const onExplainExercise = vi.fn();
    const onReplaceExercise = vi.fn();
    const onSave = vi.fn();
    const before = structuredClone(plan);

    render(
      <ConversationRoutinePreview
        plan={plan}
        catalog={new Map(catalog.map((exercise) => [exercise.id, exercise]))}
        media={new Map([
          ["press-01", availableMedia],
          ["row-01", placeholderMedia],
        ])}
        activeDayId="day-upper"
        onActiveDayChange={onActiveDayChange}
        actions={{ onExplainExercise, onReplaceExercise, onSave }}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Día 2/i }));
    await user.click(screen.getByRole("button", { name: "¿Por qué este?" }));
    await user.click(screen.getByRole("button", { name: "Reemplazar" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onActiveDayChange).toHaveBeenCalledWith("day-pull");
    expect(onExplainExercise).toHaveBeenCalledWith({
      dayId: "day-upper",
      exerciseId: "press-01",
    });
    expect(onReplaceExercise).toHaveBeenCalledWith({
      dayId: "day-upper",
      exerciseId: "press-01",
    });
    expect(onSave).toHaveBeenCalledOnce();
    expect(plan).toEqual(before);
  });

  it("renders the resolved placeholder and the selected day supplied by the parent", () => {
    render(
      <ConversationRoutinePreview
        plan={plan}
        catalog={catalog}
        media={{ "press-01": availableMedia, "row-01": placeholderMedia }}
        activeDayId="day-pull"
        onActiveDayChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Remo sentado en polea")).toBeVisible();
    expect(
      screen.getByText("Media protegida · no disponible en este entorno"),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver ejercicio" })).toHaveAttribute(
      "href",
      "/ejercicios/row-01",
    );
  });
});
