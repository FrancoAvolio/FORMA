import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { runAiProviderContractProbe } from "../contract-probe.server";
import { MockAiProvider } from "../providers/mock-provider";

it("runs the opt-in provider contract probe without external usage in tests", async () => {
  const report = await runAiProviderContractProbe(new MockAiProvider(), {
    repetitions: 1,
  });
  expect(report.checks.filter((check) => !check.passed)).toEqual([]);
  expect(report).toMatchObject({
    provider: "mock",
    model: "deterministic-fixture-v1",
    repetitions: 1,
    passed: true,
  });
  expect(report.checks).toHaveLength(7);
});
