import { normalizeDomainText } from "../exercises/normalization";

export const SESSION_DURATION_LIMITS = {
  minimum: 20,
  maximum: 120,
} as const;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  media: 30,
  veinte: 20,
  treinta: 30,
  cuarenta: 40,
  "cuarenta y cinco": 45,
  sesenta: 60,
  "setenta y cinco": 75,
  noventa: 90,
  "ciento veinte": 120,
};

function withinSupportedRange(minutes: number): number | null {
  return Number.isInteger(minutes) &&
    minutes >= SESSION_DURATION_LIMITS.minimum &&
    minutes <= SESSION_DURATION_LIMITS.maximum
    ? minutes
    : null;
}

function hoursValue(value: string): number | null {
  if (["1", "un", "uno", "una"].includes(value)) return 1;
  if (["2", "dos"].includes(value)) return 2;
  return null;
}

/** Parses explicit Spanish session-duration phrases without applying the domain range. */
function parseRequestedSessionDuration(value: string): number | null {
  const decimalSource = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(",", ".");
  const compactHours = decimalSource.match(/\b(\d)\s*h\s*(\d{1,2})\b/u);
  if (compactHours?.[1] && compactHours[2]) {
    return Number(compactHours[1]) * 60 + Number(compactHours[2]);
  }

  const decimalHours = decimalSource.match(/\b(0\.5|1\.5|2\.0)\s*horas?\b/u);
  if (decimalHours?.[1]) {
    return Number(decimalHours[1]) * 60;
  }

  const normalized = normalizeDomainText(value);
  if (/\bmedia hora\b/u.test(normalized)) return 30;

  const hours = normalized.match(/\b(\d|un|uno|una|dos)\s*(?:h|horas?)\b/u);
  if (hours?.[0] && hours[1]) {
    const hourCount = hoursValue(hours[1]);
    if (hourCount !== null) {
      const tail = normalized.slice((hours.index ?? 0) + hours[0].length);
      const half = /^\s*y?\s*media\b/u.test(tail);
      const extraMinutes = tail.match(
        /^\s*(?:y\s*)?(\d{1,2}|treinta)\s*(?:minutos?|min)?\b/u,
      )?.[1];
      const additional = half
        ? 30
        : extraMinutes === "treinta"
          ? 30
          : extraMinutes
            ? Number(extraMinutes)
            : 0;
      return hourCount * 60 + additional;
    }
  }

  const numericMinutes = normalized.match(/\b(\d{1,3})\s*(?:minutos?|min)\b/u);
  if (numericMinutes?.[1]) {
      return Number(numericMinutes[1]);
  }

  for (const [words, minutes] of Object.entries(NUMBER_WORDS)) {
    if (normalized.includes(`${words} minutos`) || normalized.includes(`${words} min`)) {
      return minutes;
    }
  }

  return null;
}

/** Parses a duration only when it fits the deterministic routine-engine range. */
export function parseSessionDuration(value: string): number | null {
  const requested = parseRequestedSessionDuration(value);
  return requested === null ? null : withinSupportedRange(requested);
}

/** Returns an explicit duration that the engine understood but cannot support. */
export function parseOutOfRangeSessionDuration(value: string): number | null {
  const requested = parseRequestedSessionDuration(value);
  return requested !== null && withinSupportedRange(requested) === null
    ? requested
    : null;
}
