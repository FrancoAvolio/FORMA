import { describe, expect, it } from "vitest";

import type { CatalogExercise } from "../../exercises/catalog-exercise";
import { assignPrescription, rirToRpe } from "../engine/assign-prescription";
import {
  buildCandidatePool,
  isEquipmentCompatible,
  resolveAvailableEquipment,
} from "../engine/build-candidate-pool";
import { chooseSplit } from "../engine/choose-split";
import { estimateSessionDuration } from "../engine/estimate-session-duration";
import { findSubstitutions } from "../engine/find-substitutions";
import { scoreExercise } from "../engine/score-exercise";
import { selectExercises } from "../engine/select-exercises";
import { CLEAR_SAFETY_SCREENING, createCatalog, createRoutineRequest } from "./fixtures";

describe("chooseSplit", () => {
  it.each([1, 2, 3, 4, 5, 6])("returns exactly %i configured days", (daysPerWeek) => {
    const split = chooseSplit(createRoutineRequest({ daysPerWeek }));
    expect(split.days).toHaveLength(daysPerWeek);
  });

  it("uses full-body training for a three-day beginner", () => {
    expect(
      chooseSplit(
        createRoutineRequest({ daysPerWeek: 3, experience: "beginner" }),
      ).id,
    ).toBe("full-body-abc");
  });

  it("can prioritize torso/limbs when a four-day request focuses arms", () => {
    expect(
      chooseSplit(createRoutineRequest({ focusMuscles: ["biceps"] })).id,
    ).toBe("torso-limbs-4");
  });
});

describe("candidate filtering", () => {
  it("filters approval, equipment, explicit names, and movement patterns", () => {
    const base = createCatalog(3);
    const incompatible: CatalogExercise = {
      ...base[0]!,
      id: "barbell-only",
      name: "Barbell forbidden test",
      equipment: ["barbell"],
    };
    const unapproved: CatalogExercise = {
      ...base[1]!,
      id: "unapproved",
      approvedForGeneration: false,
    };
    const request = createRoutineRequest({
      excludedExercises: [base[2]!.name],
      excludedMovementPatterns: ["cardio"],
    });
    const result = buildCandidatePool([...base, incompatible, unapproved], request);

    expect(result.some((exercise) => exercise.id === incompatible.id)).toBe(false);
    expect(result.some((exercise) => exercise.id === unapproved.id)).toBe(false);
    expect(result.some((exercise) => exercise.id === base[2]!.id)).toBe(false);
    expect(result.some((exercise) => exercise.movementPattern === "cardio")).toBe(false);
  });

  it("resolves empty commercial-gym equipment explicitly", () => {
    const request = createRoutineRequest({
      trainingLocation: "commercial_gym",
      availableEquipment: [],
    });
    expect(resolveAvailableEquipment(request)).toContain("dumbbell");
    expect(
      isEquipmentCompatible(
        { ...createCatalog(1)[0]!, equipment: ["dumbbell"] },
        resolveAvailableEquipment(request),
      ),
    ).toBe(true);
    expect(resolveAvailableEquipment(request)).toContain("barbell_rack");
  });

  it("does not treat a generic machine as a Smith machine", () => {
    const smithExercise = {
      ...createCatalog(1)[0]!,
      equipment: ["smith_machine"],
    };
    const genericMachineExercise = {
      ...createCatalog(1)[0]!,
      equipment: ["machine"],
    };

    expect(isEquipmentCompatible(smithExercise, ["machine"])).toBe(false);
    expect(isEquipmentCompatible(genericMachineExercise, ["smith_machine"])).toBe(true);
  });
});

describe("scoring and deterministic selection", () => {
  it("rewards the requested pattern and preferred exercises", () => {
    const catalog = createCatalog(3);
    const matching = catalog.find(
      (exercise) => exercise.movementPattern === "horizontal_push",
    )!;
    const nonMatching = catalog.find((exercise) => exercise.movementPattern === "hinge")!;
    const request = createRoutineRequest({ preferredExercises: [matching.id] });
    const day = chooseSplit({ ...request, daysPerWeek: 1 }).days[0]!;
    const context = {
      request,
      day,
      desiredPattern: "horizontal_push" as const,
      selectionIndex: 0,
      selectedExercises: [],
      usedExerciseIds: new Set<string>(),
      seed: "score-seed",
    };
    expect(scoreExercise(matching, context)).toBeGreaterThan(
      scoreExercise(nonMatching, context),
    );
  });

  it("returns reproducible unique selections for the same seed", () => {
    const catalog = createCatalog();
    const request = createRoutineRequest({ daysPerWeek: 1 });
    const day = chooseSplit(request).days[0]!;
    const context = { request, day, count: 7, seed: "fixed-seed" };
    const first = selectExercises(catalog, context).map((exercise) => exercise.id);
    const second = selectExercises(catalog, context).map((exercise) => exercise.id);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});

describe("prescription, time, and substitutions", () => {
  it("keeps RIR authoritative and derives RPE consistently", () => {
    const exercise = createCatalog(1)[0]!;
    const prescription = assignPrescription(exercise, createRoutineRequest());
    expect(prescription.rir).toBe(2);
    expect(rirToRpe(prescription.rir)).toBe(8);
    expect(prescription).not.toHaveProperty("weight");
  });

  it("estimates session time from prescribed work and rest", () => {
    const exercise = createCatalog(1)[0]!;
    const prescription = assignPrescription(exercise, createRoutineRequest());
    const minutes = estimateSessionDuration(
      [
        {
          exerciseId: exercise.id,
          ...prescription,
          selectionReasons: ["Fixture reason"],
        },
      ],
      [exercise],
    );
    expect(minutes).toBeGreaterThan(6);
  });

  it("ranks a compatible exercise from the same substitution group first", () => {
    const catalog = createCatalog(4);
    const original = catalog.find(
      (exercise) => exercise.movementPattern === "horizontal_push" && exercise.id.endsWith("00"),
    )!;
    const substitutions = findSubstitutions(
      original.id,
      catalog,
      createRoutineRequest(),
      { seed: "sub-seed" },
    );
    expect(substitutions[0]?.substitutionGroup).toBe(original.substitutionGroup);
    expect(substitutions.every((exercise) => exercise.id !== original.id)).toBe(true);
  });

  it("keeps the clear safety fixture explicit", () => {
    expect(CLEAR_SAFETY_SCREENING.confirmedCurrentStatus).toBe(true);
  });
});
