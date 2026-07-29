export const USER_MESSAGE_LIMITS = {
  characters: 4_000,
  words: 600,
} as const;

export type UserMessageMetrics = {
  characters: number;
  words: number;
  exceedsCharacterLimit: boolean;
  exceedsWordLimit: boolean;
  valid: boolean;
};

export function countUserMessageWords(value: string): number {
  const normalized = value.trim();
  return normalized ? normalized.split(/\s+/u).length : 0;
}

export function getUserMessageMetrics(value: string): UserMessageMetrics {
  const characters = value.length;
  const words = countUserMessageWords(value);
  const exceedsCharacterLimit = characters > USER_MESSAGE_LIMITS.characters;
  const exceedsWordLimit = words > USER_MESSAGE_LIMITS.words;

  return {
    characters,
    words,
    exceedsCharacterLimit,
    exceedsWordLimit,
    valid: !exceedsCharacterLimit && !exceedsWordLimit,
  };
}
