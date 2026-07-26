import { runAiProviderContractProbe } from "../src/ai/contract-probe.server";
import { OllamaAiProvider } from "../src/ai/providers/ollama-provider";

async function main(): Promise<void> {
  const provider = new OllamaAiProvider({
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL ?? "qwen3:1.7b",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 12_000),
  });

  const report = await runAiProviderContractProbe(provider, {
    repetitions: Number(process.env.AI_PROBE_REPETITIONS ?? 1),
  });

  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
