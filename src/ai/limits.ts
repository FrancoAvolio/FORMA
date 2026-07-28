export const AI_LIMITS = {
  messageCharacters: 4_000,
  notesCharacters: 1_000,
  listItems: 48,
  listItemCharacters: 120,
  planDays: 6,
  exercisesPerDay: 16,
  inputBytes: 32 * 1024,
  providerRequestBytes: 256 * 1024,
  outputBytes: 64 * 1024,
  repairPayloadCharacters: 8_000,
  // Ollama's grammar compiler rejects string maxLength=2000; 1500 remains
  // ample for the intentionally brief assistant and explanation responses.
  explanationCharacters: 1_500,
  defaultTimeoutMs: 12_000,
  ollamaDefaultTimeoutMs: 60_000,
  minimumTimeoutMs: 1_000,
  maximumTimeoutMs: 60_000,
  ollamaPredictTokens: 1_600,
  cloudflareMaxTokens: 1_600,
} as const;
