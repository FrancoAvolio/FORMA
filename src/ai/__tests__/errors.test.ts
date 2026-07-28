import { describe, expect, it } from "vitest";

import { AiProviderError, toAiFallbackState } from "../errors";

describe("AI fallback taxonomy", () => {
  it.each([
    ["unavailable", "Ollama no está iniciado"],
    ["timeout", "El modelo local tardó demasiado"],
    ["invalid_output", "El modelo local no pudo estructurar este mensaje"],
    ["unsupported_model", "El modelo local no está instalado"],
    ["misconfigured", "La configuración local está incompleta"],
  ] as const)("keeps Ollama %s distinct", (code, expectedTitle) => {
    const state = toAiFallbackState(
      new AiProviderError(code, { provider: "ollama" }),
    );

    expect(state.title).toBe(expectedTitle);
    expect(state.action).toBe("guided_form");
  });

  it("labels malformed output as retryable without claiming the provider is down", () => {
    const state = toAiFallbackState(
      new AiProviderError("invalid_output", { provider: "ollama" }),
    );

    expect(state.canRetry).toBe(true);
    expect(state.title).not.toMatch(/no est[aá] disponible/i);
  });

  it("keeps Cloudflare quota exhaustion distinct from transport failures", () => {
    const state = toAiFallbackState(
      new AiProviderError("quota_exhausted", { provider: "cloudflare" }),
    );

    expect(state.title).toMatch(/cuota gratuita/i);
    expect(state.canRetry).toBe(false);
  });
});
