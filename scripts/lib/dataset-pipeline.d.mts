export class DatasetValidationError extends Error {
  readonly issues: string[];
}

export type SourceExerciseRecord = {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: Record<string, string>;
  instruction_steps: Record<string, string[]>;
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  media_id: string;
  image: string;
  gif_url: string;
  attribution: string;
  created_at: string;
};

export function sha256(value: string | Uint8Array): string;
export function gitBlobObjectId(
  value: Uint8Array,
  objectFormat?: "sha1" | "sha256",
): string;
export function mediaInventoryDigest(entries: unknown[]): string;
export function curationReviewDigest(value: {
  records: Array<{ exerciseId: string }>;
  names: Record<string, string>;
  exclusions: Array<{ exerciseId: string }>;
}): string;
export function parseJsonBuffer(buffer: Uint8Array, label: string): unknown;
export function normalizeText(value: string): string;
export function normalizeToken(value: string): string;
export function validateSourceDataset(
  records: SourceExerciseRecord[],
  schema: unknown,
): {
  totalExercises: number;
  duplicateIds: string[];
  incompleteSpanishInstructionIds: string[];
};
export function normalizeExercise(record: SourceExerciseRecord): {
  id: string;
  sourceName: string;
  equipment: string;
};
export function isSafeGeneratedMediaUrl(value: unknown): boolean;
