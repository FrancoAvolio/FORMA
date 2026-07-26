/** Stable FNV-1a hash; does not depend on Node, Web Crypto, locale, or process state. */
export function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function deterministicUnitInterval(seed: string, key: string): number {
  return stableHash(`${seed}\u0000${key}`) / 0x1_0000_0000;
}

export function deterministicId(prefix: string, source: string): string {
  return `${prefix}-${stableHash(source).toString(36).padStart(7, "0")}`;
}

const ISO_UTC_PREFIX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\|/;
const DETERMINISTIC_EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Application boundaries can create a user-meaningful seed while keeping the
 * domain's complete output reproducible from that seed.
 */
export function createRoutineSeed(generatedAt: string, entropy: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(generatedAt)) {
    throw new Error("generatedAt must be an ISO-8601 UTC timestamp.");
  }
  if (entropy.trim().length === 0 || entropy.includes("|")) {
    throw new Error("Seed entropy must be non-empty and must not contain '|'.");
  }
  return `${generatedAt}|${entropy}`;
}

export function generatedAtFromSeed(seed: string): string {
  return seed.match(ISO_UTC_PREFIX)?.[1] ?? DETERMINISTIC_EPOCH;
}
