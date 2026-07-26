import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AiProviderError, toAiFallbackState } from "../errors";
import { MockAiProvider } from "../providers/mock-provider";
import { describeAiProviderContract } from "../test-support/provider-contract";

describeAiProviderContract("Mock", () => new MockAiProvider());

describe("MockAiProvider scenarios", () => {
  it.each([
    {
      message: "Quiero entrenar cuatro días para ganar músculo.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.request.goal).toBe("hypertrophy");
        expect(result.request.daysPerWeek).toBe(4);
        expect(result.status).toBe("needs_input");
      },
    },
    {
      message: "Sólo tengo dos mancuernas.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.request.availableEquipment).toContain("dumbbell");
      },
    },
    {
      message: "No quiero hacer peso muerto.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.request.excludedExercises).toContain("deadlift");
      },
    },
    {
      message: "Quiero entrenar pecho todos los días.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.request.focusMuscles).toContain("chest");
      },
    },
    {
      message: "Me lesioné ayer, armame una rutina.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.status).toBe("unsupported");
        expect(result.safetySignals).toContain("recent_injury");
      },
    },
    {
      message:
        "Quiero entrenar tres veces por semana durante cuarenta minutos.",
      assertion: (result: Awaited<ReturnType<MockAiProvider["parseRoutineRequest"]>>) => {
        expect(result.request.daysPerWeek).toBe(3);
        expect(result.request.sessionMinutes).toBe(40);
      },
    },
  ])("parses the required contract prompt: $message", async ({ message, assertion }) => {
    const result = await new MockAiProvider().parseRoutineRequest({ message });
    assertion(result);
  });

  it("returns configurable provider failures with a guided-form fallback", async () => {
    const provider = new MockAiProvider({
      errors: { parse_routine_request: "quota_exhausted" },
    });
    const error = await provider
      .parseRoutineRequest({ message: "Quiero una rutina." })
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
      title: "El asistente local no está disponible",
      message: "Podés iniciar Ollama o continuar con el formulario guiado.",
    });
    expect(
      toAiFallbackState(
        new AiProviderError("quota_exhausted", { provider: "cloudflare" }),
      ),
    ).toMatchObject({
      title: "El asistente alcanzó su límite de uso",
      message: expect.stringContaining("Tu información sigue guardada"),
    });
  });

  it("honors caller cancellation", async () => {
    const controller = new AbortController();
    const provider = new MockAiProvider({ delayMs: 100 });
    const result = provider.parseRoutineRequest({
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
      new MockAiProvider({ delayMs: 100 }).parseRoutineRequest({
        message: "Quiero una rutina.",
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: "aborted" });
  });
});
