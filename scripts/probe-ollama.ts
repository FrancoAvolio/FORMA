import { runAiProviderContractProbe } from "../src/ai/contract-probe.server";
import { OllamaAiProvider } from "../src/ai/providers/ollama-provider";

async function main(): Promise<void> {
  const configuredModels =
    process.env.OLLAMA_MODELS?.split(",") ??
    (process.env.OLLAMA_MODEL
      ? [process.env.OLLAMA_MODEL]
      : ["qwen3:4b", "qwen3:1.7b"]);
  const models = [...new Set(configuredModels.map((model) => model.trim()))].filter(
    Boolean,
  );
  const reports = [];

  for (const model of models) {
    const provider = new OllamaAiProvider({
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
      model,
      timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 60_000),
    });
    try {
      reports.push(
        await runAiProviderContractProbe(provider, {
          repetitions: Number(process.env.AI_PROBE_REPETITIONS ?? 1),
        }),
      );
    } catch (error) {
      reports.push({
        provider: provider.id,
        model,
        repetitions: 0,
        passed: false,
        checks: [],
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "UnknownError", message: "Unknown Ollama probe error" },
      });
    }
  }

  console.log(JSON.stringify({ reports }, null, 2));
  if (reports.some((report) => !report.passed)) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
