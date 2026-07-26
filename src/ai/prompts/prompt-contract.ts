export type PromptExample = Readonly<{
  input: string;
  output: string;
}>;

export type VersionedPrompt = Readonly<{
  id: string;
  version: string;
  purpose: string;
  system: string;
  examples: readonly PromptExample[];
}>;

export function serializePromptData(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

