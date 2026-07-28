import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CloudflareAiProvider,
  type CloudflareAiBinding,
} from "../providers/cloudflare-provider";
import {
  completeParseInput,
  responseForOperation,
} from "../test-support/fixtures";
import { describeAiProviderContract } from "../test-support/provider-contract";

function operationFromRequest(request: Record<string, unknown>): string {
  const toolChoice = request.tool_choice as {
    function?: { name?: string };
  };
  return String(toolChoice.function?.name).replace(/^forma_/, "");
}

function toolCallResponse(operation: string): unknown {
  return {
    tool_calls: [
      {
        function: {
          name: `forma_${operation}`,
          arguments: JSON.stringify(responseForOperation(operation)),
        },
      },
    ],
  };
}

function createContractBinding(): CloudflareAiBinding {
  return {
    run: vi.fn(async (_model, request) => {
      const operation = operationFromRequest(request);
      return toolCallResponse(operation);
    }),
  };
}

describeAiProviderContract(
  "Cloudflare (simulated binding)",
  () => new CloudflareAiProvider({ binding: createContractBinding() }),
);

describe("CloudflareAiProvider binding", () => {
  it("keeps the binding mandatory and server-injected", async () => {
    await expect(
      new CloudflareAiProvider().parseRoutineTurn(completeParseInput),
    ).rejects.toMatchObject({ code: "binding_missing" });
  });

  it("passes the complete contract as a forced function call by default", async () => {
    const binding = createContractBinding();
    await new CloudflareAiProvider({ binding }).parseRoutineTurn(
      completeParseInput,
    );
    const [model, request, options] = vi.mocked(binding.run).mock.calls[0]!;
    expect(model).toBe("@cf/ibm-granite/granite-4.0-h-micro");
    expect(request).toMatchObject({
      tools: [
        {
          type: "function",
          function: {
            name: "forma_parse_routine_turn",
            parameters: expect.objectContaining({
              type: "object",
              properties: expect.objectContaining({
                intent: expect.any(Object),
                requestPatch: expect.any(Object),
              }),
            }),
          },
        },
      ],
      tool_choice: {
        function: { name: "forma_parse_routine_turn" },
      },
    });
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it("supports Workers AI json_schema mode without changing the provider interface", async () => {
    const binding: CloudflareAiBinding = {
      run: vi.fn(async (_model, request) => {
        expect(request.response_format).toMatchObject({
          type: "json_schema",
          json_schema: expect.objectContaining({ type: "object" }),
        });
        return responseForOperation("parse_routine_turn");
      }),
    };
    await expect(
      new CloudflareAiProvider({ binding, structuredMode: "json_schema" })
        .parseRoutineTurn(completeParseInput),
    ).resolves.toMatchObject({ intent: "provide_information" });
  });

  it("maps daily free-quota exhaustion distinctly from rate limiting", async () => {
    const binding: CloudflareAiBinding = {
      run: vi.fn(async () => {
        throw { status: 429, message: "Daily neurons quota exceeded" };
      }),
    };
    await expect(
      new CloudflareAiProvider({ binding }).parseRoutineTurn(
        completeParseInput,
      ),
    ).rejects.toMatchObject({ code: "quota_exhausted" });
  });

  it("uses a configured fallback model only when the primary is unsupported", async () => {
    const run = vi.fn(async (model: string, request: Record<string, unknown>) => {
      if (model.includes("granite")) {
        throw { status: 404, message: "Unsupported model" };
      }
      return toolCallResponse(operationFromRequest(request));
    });
    const provider = new CloudflareAiProvider({
      binding: { run },
      fallbackModel: "@cf/meta/llama-small-contract-model",
    });

    await expect(
      provider.parseRoutineTurn(completeParseInput),
    ).resolves.toMatchObject({ intent: "provide_information" });
    expect(run.mock.calls.map(([model]) => model)).toEqual([
      "@cf/ibm-granite/granite-4.0-h-micro",
      "@cf/meta/llama-small-contract-model",
    ]);
  });
});
