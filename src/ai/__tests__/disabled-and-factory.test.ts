import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { DisabledAiProvider } from "../providers/disabled-provider";
import { createAiProvider } from "../providers/provider-factory";
import { completeParseInput } from "../test-support/fixtures";

describe("disabled provider and server-side provider factory", () => {
  it("fails immediately with the deterministic disabled state", async () => {
    await expect(
      new DisabledAiProvider().parseRoutineRequest(completeParseInput),
    ).rejects.toMatchObject({
      code: "disabled",
      fallbackRecommended: true,
    });
  });

  it("uses Ollama by default outside production", () => {
    const provider = createAiProvider({
      environment: { NODE_ENV: "development" },
      fetchImplementation: vi.fn() as unknown as typeof fetch,
    });
    expect(provider).toMatchObject({ id: "ollama", model: "qwen3:1.7b" });
  });

  it("uses Cloudflare by default in production without reading client variables", () => {
    const provider = createAiProvider({
      environment: { NODE_ENV: "production" },
      cloudflareBinding: null,
    });
    expect(provider).toMatchObject({
      id: "cloudflare",
      model: "@cf/ibm-granite/granite-4.0-h-micro",
    });
  });

  it.each(["mock", "disabled"] as const)(
    "selects the %s provider explicitly",
    (providerName) => {
      expect(
        createAiProvider({
          environment: { AI_PROVIDER: providerName, NODE_ENV: "test" },
        }).id,
      ).toBe(providerName);
    },
  );

  it("fails closed on an invalid provider configuration", () => {
    expect(() =>
      createAiProvider({
        environment: { AI_PROVIDER: "not-a-provider", NODE_ENV: "test" },
      }),
    ).toThrow(expect.objectContaining({ code: "misconfigured" }));
  });
});
