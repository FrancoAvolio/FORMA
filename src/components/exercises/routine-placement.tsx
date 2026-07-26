"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

import { createBrowserRoutineRepository } from "@/persistence";

type Placement = {
  dayName: string;
  sets: number;
  repetitions: string;
};

export function RoutinePlacement({ exerciseId }: { exerciseId: string }) {
  const [placements, setPlacements] = useState<Placement[] | null>(null);

  useEffect(() => {
    void createBrowserRoutineRepository()
      .loadCurrentRoutine()
      .then((current) => {
        if (!current) {
          setPlacements([]);
          return;
        }
        setPlacements(
          current.plan.days.flatMap((day) =>
            day.exercises
              .filter((exercise) => exercise.exerciseId === exerciseId)
              .map((exercise) => ({
                dayName: day.name,
                sets: exercise.sets,
                repetitions: exercise.repPrescription,
              })),
          ),
        );
      });
  }, [exerciseId]);

  if (placements === null) {
    return <p aria-live="polite">Revisando tu rutina local…</p>;
  }
  if (placements.length === 0) {
    return <p>Este ejercicio todavía no está en tu rutina actual.</p>;
  }

  return (
    <ul>
      {placements.map((placement) => (
        <li key={placement.dayName}>
          <CheckCircle2 aria-hidden="true" size={17} />
          {placement.dayName}: {placement.sets} series de {placement.repetitions}
        </li>
      ))}
    </ul>
  );
}
