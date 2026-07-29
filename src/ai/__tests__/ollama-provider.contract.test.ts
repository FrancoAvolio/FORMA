import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OllamaAiProvider } from "../providers/ollama-provider";
import {
  completeParseInput,
  completeParsedTurn,
  assistantResponseResult,
  explanationResult,
  modificationResult,
  safetyResult,
} from "../test-support/fixtures";
import { describeAiProviderContract } from "../test-support/provider-contract";

function responseForSystemPrompt(system: string): unknown {
  if (system.includes("strict data extractor")) return completeParsedTurn;
  if (system.includes("voz conversacional")) return assistantResponseResult;
  if (system.includes("modificación solicitada")) return modificationResult;
  if (system.includes("Clasificás señales")) return safetyResult;
  if (system.includes("Explicás en español")) return explanationResult;
  throw new Error("No fixture matched the Ollama system prompt");
}

function ollamaResponse(content: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      model: "qwen3:4b",
      message: {
        role: "assistant",
        content: typeof content === "string" ? content : JSON.stringify(content),
      },
      done: true,
    }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
}

function createContractFetch(): typeof fetch {
  return vi.fn(async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      messages: { role: string; content: string }[];
    };
    const system = body.messages.find((message) => message.role === "system")!;
    return ollamaResponse(responseForSystemPrompt(system.content));
  }) as unknown as typeof fetch;
}

describeAiProviderContract(
  "Ollama (simulated transport)",
  () => new OllamaAiProvider({ fetchImplementation: createContractFetch() }),
);

describe("OllamaAiProvider transport", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends the complete JSON Schema and disables streaming/thinking", async () => {
    const fetchImplementation = createContractFetch();
    await new OllamaAiProvider({ fetchImplementation }).parseRoutineTurn(
      completeParseInput,
    );

    const [, init] = vi.mocked(fetchImplementation).mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: "qwen3:4b",
      stream: false,
      think: false,
    });
    expect(body.format).toMatchObject({
      type: "object",
      properties: expect.objectContaining({
        intent: expect.any(Object),
        requestPatch: expect.any(Object),
      }),
    });
    expect(
      (body.format as { properties: Record<string, unknown> }).properties,
    ).not.toHaveProperty("status");
  });

  it("repairs invalid structured output exactly once", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(ollamaResponse('{"intent":"greeting"}'))
      .mockResolvedValueOnce(ollamaResponse(completeParsedTurn)) as unknown as typeof fetch;
    const provider = new OllamaAiProvider({ fetchImplementation });

    await expect(
      provider.parseRoutineTurn(completeParseInput),
    ).resolves.toEqual(completeParsedTurn);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("fails closed after the single repair remains invalid", async () => {
    const fetchImplementation = vi.fn(async () =>
      ollamaResponse('{"intent":"greeting"}'),
    ) as unknown as typeof fetch;
    const provider = new OllamaAiProvider({ fetchImplementation });

    await expect(
      provider.parseRoutineTurn(completeParseInput),
    ).rejects.toMatchObject({ code: "invalid_output" });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("maps a connection failure to provider unavailable", async () => {
    const provider = new OllamaAiProvider({
      fetchImplementation: vi.fn(async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(
      provider.parseRoutineTurn(completeParseInput),
    ).rejects.toMatchObject({ code: "unavailable" });
  });

  it("enforces its deadline", async () => {
    vi.useFakeTimers();
    const provider = new OllamaAiProvider({
      timeoutMs: 1_000,
      fetchImplementation: vi.fn(
        () => new Promise<Response>(() => undefined),
      ) as unknown as typeof fetch,
    });
    const pending = provider.parseRoutineTurn(completeParseInput);
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(1_001);
    await assertion;
  });

  it("rejects an oversized provider envelope", async () => {
    const provider = new OllamaAiProvider({
      fetchImplementation: vi.fn(async () => ollamaResponse("x".repeat(70_000))) as unknown as typeof fetch,
    });
    await expect(
      provider.parseRoutineTurn(completeParseInput),
    ).rejects.toMatchObject({ code: "response_too_large" });
  });
});
