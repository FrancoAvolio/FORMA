import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiProviderError, toAiFallbackState } from "../errors";
import { MockAiProvider } from "../providers/mock-provider";
import { describeAiProviderContract } from "../test-support/provider-contract";
import { modificationInput } from "../test-support/fixtures";

describeAiProviderContract("Mock", () => new MockAiProvider());

describe("MockAiProvider scenarios", () => {
  it.each([
    {
      message: "Hola bro",
      expected: {
        intent: "greeting",
        requestPatch: {},
        limitationsConfirmation: "unknown",
      },
    },
    {
      message: "Quiero crecer mis bíceps",
      expected: {
        intent: "provide_information",
        requestPatch: {
          goal: "hypertrophy",
          focusMuscles: ["biceps"],
        },
      },
    },
    {
      message: "Soy intermedio, entreno cuatro días y tengo gimnasio completo",
      expected: {
        intent: "provide_information",
        requestPatch: {
          experience: "intermediate",
          daysPerWeek: 4,
          trainingLocation: "commercial_gym",
        },
      },
    },
    {
      message: "Una hora por sesión y no tengo ninguna lesión ni restricción",
      expected: {
        intent: "provide_information",
        requestPatch: { sessionMinutes: 60, limitations: [] },
        limitationsConfirmation: "no_limitations",
      },
    },
    {
      message: "Una hora y media por sesión",
      expected: {
        intent: "provide_information",
        requestPatch: { sessionMinutes: 90 },
      },
    },
    {
      message: "Cambiame el press por una máquina",
      expected: { intent: "modify_routine", requestPatch: {} },
    },
    {
      message: "No quiero usar barra",
      expected: { intent: "modify_routine", requestPatch: {} },
    },
    {
      message: "¿Por qué pusiste este ejercicio?",
      expected: { intent: "ask_question", requestPatch: {} },
    },
  ])("extracts only the latest turn: $message", async ({ message, expected }) => {
    await expect(
      new MockAiProvider().parseRoutineTurn({ message }),
    ).resolves.toMatchObject(expected);
  });

  it("returns only the corrected field instead of echoing canonical state", async () => {
    const result = await new MockAiProvider().parseRoutineTurn({
      message: "En realidad quiero entrenar tres días",
      currentDraft: {
        goal: "hypertrophy",
        experience: "intermediate",
        daysPerWeek: 4,
        sessionMinutes: 60,
        trainingLocation: "commercial_gym",
        availableEquipment: ["machine"],
        focusMuscles: ["biceps"],
        excludedExercises: [],
        excludedMovementPatterns: [],
        preferredExercises: [],
        limitations: [],
        notes: null,
      },
      currentLimitationsConfirmation: "confirmed_none",
    });
    expect(result).toMatchObject({
      intent: "modify_profile",
      requestPatch: { daysPerWeek: 3 },
      limitationsConfirmation: "unknown",
    });
    expect(Object.keys(result.requestPatch)).toEqual(["daysPerWeek"]);
  });

  it("parses subtractive equipment and one-day shortening as typed changes", async () => {
    const provider = new MockAiProvider();
    await expect(
      provider.parseRoutineModification({
        ...modificationInput,
        message: "Ahora tengo una hora y media.",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      modification: {
        kind: "update_request",
        patch: { sessionMinutes: 90 },
      },
    });
    await expect(
      provider.parseRoutineModification({
        ...modificationInput,
        message: "No quiero usar barra.",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      modification: { kind: "exclude_equipment", equipment: ["barbell"] },
    });
    await expect(
      provider.parseRoutineModification({
        ...modificationInput,
        message: "Hacé Torso A más corto.",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      modification: {
        kind: "shorten_day",
        dayId: "day-1",
        targetMinutes: null,
      },
    });
    await expect(
      provider.parseRoutineModification({
        ...modificationInput,
        message:
          "Cambiame el press inclinado con mancuernas por uno con máquina.",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      modification: {
        kind: "replace_exercise",
        requestedAlternative: "uno con maquina.",
      },
    });
    await expect(
      provider.parseRoutineModification({
        ...modificationInput,
        message: "Sacame un ejercicio de biceps.",
      }),
    ).resolves.toMatchObject({
      status: "ready",
      modification: { kind: "remove_one_by_muscle", muscle: "biceps" },
    });
  });

  it.each([
    {
      message: "Quiero entrenar cuatro días para ganar músculo.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.requestPatch.goal).toBe("hypertrophy");
        expect(result.requestPatch.daysPerWeek).toBe(4);
        expect(result.intent).toBe("provide_information");
      },
    },
    {
      message: "Sólo tengo dos mancuernas.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.requestPatch.availableEquipment).toContain("dumbbell");
      },
    },
    {
      message: "No quiero hacer peso muerto.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.requestPatch.excludedExercises).toContain("deadlift");
      },
    },
    {
      message: "Quiero entrenar pecho todos los días.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.requestPatch.focusMuscles).toContain("chest");
      },
    },
    {
      message: "Me lesioné ayer, armame una rutina.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.intent).toBe("unsupported");
        expect(result.safetySignals).toContain("recent_injury");
      },
    },
    {
      message:
        "Quiero entrenar tres veces por semana durante cuarenta minutos.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineTurn"]>>) => {
        expect(result.requestPatch.daysPerWeek).toBe(3);
        expect(result.requestPatch.sessionMinutes).toBe(40);
      },
    },
  ])("parses the required contract prompt: $message", async ({ message, assertion }) => {
    const result = await new MockAiProvider().parseRoutineTurn({ message });
    assertion(result);
  });

  it("returns configurable provider failures with a guided-form fallback", async () => {
    const provider = new MockAiProvider({
      errors: { parse_routine_turn: "quota_exhausted" },
    });
    const error = await provider
      .parseRoutineTurn({ message: "Quiero una rutina." })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiProviderError);
    expect(toAiFallbackState(error)).toMatchObject({
      code: "quota_exhausted",
      action: "guided_form",
      canRetry: false,
    });
  });

  it("provides provider-specific preserved-state fallback copy", () => {
    expect(
      toAiFallbackState(
        new AiProviderError("unavailable", { provider: "ollama" }),
      ),
    ).toMatchObject({
      title: "Ollama no está iniciado",
      message: expect.stringContaining("Tu progreso sigue guardado"),
    });
    expect(
      toAiFallbackState(
        new AiProviderError("quota_exhausted", { provider: "cloudflare" }),
      ),
    ).toMatchObject({
      title: "La cuota gratuita del asistente se agotó temporalmente",
      message: expect.stringContaining("Tu información sigue guardada"),
    });
  });

  it("honors caller cancellation", async () => {
    const controller = new AbortController();
    const provider = new MockAiProvider({ delayMs: 100 });
    const result = provider.parseRoutineTurn({
      message: "Quiero una rutina.",
      signal: controller.signal,
    });
    controller.abort();
    await expect(result).rejects.toMatchObject({ code: "aborted" });
  });

  it("does not start work for an already-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new MockAiProvider({ delayMs: 100 }).parseRoutineTurn({
        message: "Quiero una rutina.",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
  });
});
