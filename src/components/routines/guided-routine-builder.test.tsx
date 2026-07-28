/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RoutineRequest } from "@/domain/profile/routine-request";
import { createEmptyRoutineRequestDraft } from "@/domain/profile/routine-draft";
import type { RoutinePlan } from "@/domain/routine/schemas";
import { evaluateRoutineSafety } from "@/domain/safety/evaluate-safety";
import type { SafetyScreening } from "@/domain/safety/schemas";
import {
  createBrowserRoutineRepository,
  type ConversationSafetyState,
} from "@/persistence";

import { GuidedRoutineBuilder } from "./guided-routine-builder";

const { generateRoutineUseCaseMock, pushMock } = vi.hoisted(() => ({
  generateRoutineUseCaseMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/application/routines", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/application/routines")>();
  return {
    ...actual,
    generateRoutineUseCase: generateRoutineUseCaseMock,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const request: RoutineRequest = {
  goal: "strength",
  experience: "advanced",
  daysPerWeek: 2,
  sessionMinutes: 45,
  trainingLocation: "home",
  availableEquipment: ["body_weight"],
  focusMuscles: ["back"],
  excludedExercises: ["peso muerto"],
  excludedMovementPatterns: ["hinge"],
  preferredExercises: [],
  limitations: [],
  notes: "Perfil creado en el chat.",
};

const clearSafety: SafetyScreening = {
  confirmedCurrentStatus: true,
  painDuringMovement: false,
  recentInjury: false,
  recentOperation: false,
  medicalRestriction: false,
  symptomsDuringExercise: false,
  professionalInstructionsAffectTraining: false,
};

const plan: RoutinePlan = {
  id: "guided-plan",
  title: "Rutina guiada",
  goal: "strength",
  daysPerWeek: 2,
  summary: "Plan validado desde el formulario guiado.",
  splitId: "full-body-ab",
  splitName: "Cuerpo completo A/B",
  days: [
    {
      id: "day-a",
      name: "Día A",
      focus: ["cuerpo completo"],
      estimatedMinutes: 45,
      exercises: [
        {
          exerciseId: "fixture-exercise",
          sets: 3,
          repPrescription: "6-8",
          restSeconds: 120,
          rir: 2,
          tempo: null,
          notes: [],
          selectionReasons: ["Compatible con el pedido validado."],
        },
      ],
    },
  ],
  warnings: [],
  assumptions: [],
  generatedAt: "2026-07-28T18:00:00.000Z",
  engineVersion: "test",
  datasetVersion: "test-dataset",
  seed: "guided-test-seed",
};

const messages = [
  {
    id: "user-message",
    role: "user" as const,
    content: "Quiero una rutina de fuerza en casa.",
    createdAt: "2026-07-28T17:00:00.000Z",
  },
];

const providerState = {
  status: "ready" as const,
  providerId: "mock" as const,
  model: "guided-test-model",
  error: null,
};

async function seedCanonicalState({
  canonicalRequest = request,
  currentPlan = plan,
  safetySignals = [],
}: {
  canonicalRequest?: RoutineRequest;
  currentPlan?: RoutinePlan | null;
  safetySignals?: ConversationSafetyState["signals"];
} = {}) {
  const repository = createBrowserRoutineRepository();
  await repository.updateRoutineConversationState({
    messages,
    requestDraft: canonicalRequest,
    limitationsConfirmation: "confirmed_none",
    safety: {
      signals: safetySignals,
      screening: clearSafety,
      result: evaluateRoutineSafety(canonicalRequest, clearSafety),
    },
    currentRoutine: currentPlan
      ? {
          request: canonicalRequest,
          plan: currentPlan,
          safetyScreening: clearSafety,
          updatedAt: "2026-07-28T18:00:00.000Z",
        }
      : null,
    providerState,
  });
}

function continueToStep(targetStep: number): void {
  for (let index = 0; index < targetStep; index += 1) {
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  }
}

beforeEach(() => {
  window.localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("GuidedRoutineBuilder canonical persistence", () => {
  it("hydrates chat state and removes a plan that no longer matches a manual edit", async () => {
    await seedCanonicalState();

    render(
      <GuidedRoutineBuilder catalog={[]} datasetVersion="test-dataset" />,
    );

    const strengthOption = await screen.findByRole("button", {
      name: /Fuerza/,
    });
    await waitFor(() =>
      expect(strengthOption).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByRole("link", { name: /Volver al chat/ })).toHaveAttribute(
      "href",
      "/crear/chat",
    );

    fireEvent.click(screen.getByRole("button", { name: /Hipertrofia/ }));

    await waitFor(async () => {
      const canonical =
        await createBrowserRoutineRepository().loadRoutineConversationState();
      expect(canonical.requestDraft.goal).toBe("hypertrophy");
      expect(canonical.messages).toEqual(messages);
      expect(canonical.providerState).toEqual(providerState);
      expect(canonical.currentRoutine).toBeNull();
    });

    continueToStep(5);
    expect(screen.getAllByRole("radio", { name: "No" })).toHaveLength(6);
    for (const answer of screen.getAllByRole("radio", { name: "No" })) {
      expect(answer).toBeChecked();
    }
    expect(
      screen.getByRole("checkbox", {
        name: /Confirmo que estas respuestas describen mi situación actual/,
      }),
    ).toBeChecked();

    fireEvent.click(screen.getAllByRole("radio", { name: "Sí" })[0]!);
    await waitFor(async () => {
      const canonical =
        await createBrowserRoutineRepository().loadRoutineConversationState();
      expect(canonical.safety.screening?.painDuringMovement).toBe(true);
      expect(canonical.safety.result?.allowed).toBe(false);
      expect(canonical.messages).toEqual(messages);
      expect(canonical.providerState).toEqual(providerState);
      expect(canonical.currentRoutine).toBeNull();
    });
  });

  it("does not promote visual defaults into a partial draft merely by opening the form", async () => {
    const repository = createBrowserRoutineRepository();
    await repository.updateRoutineConversationState({
      requestDraft: {
        ...createEmptyRoutineRequestDraft(),
        goal: "strength",
        daysPerWeek: 4,
      },
      limitationsConfirmation: "not_confirmed",
    });

    render(
      <GuidedRoutineBuilder catalog={[]} datasetVersion="test-dataset" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Fuerza/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    await waitFor(async () => {
      const canonical = await repository.loadRoutineConversationState();
      expect(canonical.requestDraft).toMatchObject({
        goal: "strength",
        daysPerWeek: 4,
        experience: null,
        sessionMinutes: null,
        trainingLocation: null,
        availableEquipment: [],
      });
      expect(canonical.completionPercentage).toBe(33);
    });
  });

  it("keeps query-parameter examples authoritative and writes them to v2 state", async () => {
    render(
      <GuidedRoutineBuilder
        catalog={[]}
        datasetVersion="test-dataset"
        example="home"
      />,
    );

    await waitFor(async () => {
      const canonical =
        await createBrowserRoutineRepository().loadRoutineConversationState();
      expect(canonical.requestDraft.trainingLocation).toBe("home");
      expect(canonical.requestDraft.availableEquipment).toEqual([
        "body_weight",
        "dumbbell",
      ]);
    });
  });

  it("keeps a chat safety signal when the manual review still reports risk", async () => {
    await seedCanonicalState({
      currentPlan: null,
      safetySignals: ["recent_injury"],
    });

    render(
      <GuidedRoutineBuilder catalog={[]} datasetVersion="test-dataset" />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Fuerza/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    continueToStep(5);
    expect(
      screen.getByText("El chat marcó un posible límite de seguridad."),
    ).toBeVisible();
    for (const answer of screen.getAllByRole("radio", { name: "No" })) {
      fireEvent.click(answer);
    }
    fireEvent.click(screen.getAllByRole("radio", { name: "Sí" })[1]!);
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Confirmo que estas respuestas describen mi situación actual/,
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /señal anterior fue una interpretación incorrecta/,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /Generar rutina/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "El chat registró una señal de seguridad",
    );
    expect(generateRoutineUseCaseMock).not.toHaveBeenCalled();
    const canonical =
      await createBrowserRoutineRepository().loadRoutineConversationState();
    expect(canonical.safety.signals).toEqual(["recent_injury"]);
    expect(canonical.currentRoutine).toBeNull();
    expect(canonical.messages).toEqual(messages);
    expect(canonical.providerState).toEqual(providerState);
  });

  it("clears a false-positive chat signal only after a complete explicit review", async () => {
    await seedCanonicalState({
      currentPlan: null,
      safetySignals: ["recent_injury"],
    });
    generateRoutineUseCaseMock.mockReturnValue({ ok: true, plan });

    render(
      <GuidedRoutineBuilder catalog={[]} datasetVersion="test-dataset" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Fuerza/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    continueToStep(5);
    for (const answer of screen.getAllByRole("radio", { name: "No" })) {
      fireEvent.click(answer);
    }
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Confirmo que estas respuestas describen mi situación actual/,
      }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /señal anterior fue una interpretación incorrecta/,
      }),
    );

    await waitFor(async () => {
      const canonical =
        await createBrowserRoutineRepository().loadRoutineConversationState();
      expect(canonical.safety.signals).toEqual([]);
      expect(canonical.safety.result?.allowed).toBe(true);
    });

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: /Generar rutina/ }));
    await waitFor(() => expect(generateRoutineUseCaseMock).toHaveBeenCalled());
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rutina"));
  });

  it("stores deterministic generation in the same currentRoutine snapshot", async () => {
    const generatedRequest: RoutineRequest = {
      ...request,
      goal: "strength",
    };
    await seedCanonicalState({
      canonicalRequest: generatedRequest,
      currentPlan: null,
    });
    generateRoutineUseCaseMock.mockReturnValue({ ok: true, plan });

    render(
      <GuidedRoutineBuilder catalog={[]} datasetVersion="test-dataset" />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Fuerza/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    continueToStep(6);
    fireEvent.click(screen.getByRole("button", { name: /Generar rutina/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/rutina"));
    const canonical =
      await createBrowserRoutineRepository().loadRoutineConversationState();
    expect(canonical.currentRoutine?.request).toEqual(generatedRequest);
    expect(canonical.currentRoutine?.plan).toEqual(plan);
    expect(canonical.currentRoutine?.safetyScreening).toEqual(clearSafety);
    expect(canonical.messages).toEqual(messages);
    expect(canonical.providerState).toEqual(providerState);
  });
});
