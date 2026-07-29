import { describe, expect, it } from "vitest";

import {
  countUserMessageWords,
  getUserMessageMetrics,
  USER_MESSAGE_LIMITS,
} from "./user-message";

describe("user message limits", () => {
  it("counts words across repeated whitespace and line breaks", () => {
    expect(countUserMessageWords("  uno\n\n dos\t tres  ")).toBe(3);
    expect(countUserMessageWords("   ")).toBe(0);
  });

  it("accepts the exact word and character boundaries", () => {
    const words = Array.from(
      { length: USER_MESSAGE_LIMITS.words },
      () => "a",
    ).join(" ");
    const characters = "a".repeat(USER_MESSAGE_LIMITS.characters);

    expect(getUserMessageMetrics(words)).toMatchObject({
      words: USER_MESSAGE_LIMITS.words,
      exceedsWordLimit: false,
      valid: true,
    });
    expect(getUserMessageMetrics(characters)).toMatchObject({
      characters: USER_MESSAGE_LIMITS.characters,
      exceedsCharacterLimit: false,
      valid: true,
    });
  });

  it("reports each exceeded boundary without truncating the source text", () => {
    const tooManyWords = Array.from(
      { length: USER_MESSAGE_LIMITS.words + 1 },
      () => "a",
    ).join(" ");
    const tooManyCharacters = "a".repeat(USER_MESSAGE_LIMITS.characters + 1);

    expect(getUserMessageMetrics(tooManyWords)).toMatchObject({
      exceedsWordLimit: true,
      valid: false,
    });
    expect(getUserMessageMetrics(tooManyCharacters)).toMatchObject({
      exceedsCharacterLimit: true,
      valid: false,
    });
    expect(tooManyCharacters).toHaveLength(USER_MESSAGE_LIMITS.characters + 1);
  });
});
