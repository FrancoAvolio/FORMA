import { createHash } from "node:crypto";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { REQUIRED_LANGUAGES } from "./dataset-config.mjs";

export class DatasetValidationError extends Error {
  constructor(message, issues) {
    super(`${message}\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "DatasetValidationError";
    this.issues = issues;
  }
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function gitBlobObjectId(value, objectFormat = "sha1") {
  if (!["sha1", "sha256"].includes(objectFormat)) {
    throw new Error(`Unsupported Git object format ${objectFormat}.`);
  }
  return createHash(objectFormat)
    .update(`blob ${value.length}\0`)
    .update(value)
    .digest("hex");
}

export function mediaInventoryDigest(entries) {
  const inventory = entries
    .map((entry) => ({
      exerciseId: entry.exerciseId,
      mediaId: entry.mediaId,
      thumbnail: {
        sourcePath: entry.thumbnail.sourcePath,
        byteSize: entry.thumbnail.byteSize,
        sha256: entry.thumbnail.sha256,
        sourceGitBlob: entry.thumbnail.sourceGitBlob,
        width: entry.thumbnail.width,
        height: entry.thumbnail.height,
      },
      animation: {
        sourcePath: entry.animation.sourcePath,
        byteSize: entry.animation.byteSize,
        sha256: entry.animation.sha256,
        sourceGitBlob: entry.animation.sourceGitBlob,
        width: entry.animation.width,
        height: entry.animation.height,
      },
    }))
    .sort((left, right) => left.exerciseId.localeCompare(right.exerciseId, "en"));
  return sha256(Buffer.from(JSON.stringify(inventory), "utf8"));
}

export function curationReviewDigest({ records, names, exclusions }) {
  const canonical = {
    records: [...records].sort((left, right) =>
      left.exerciseId.localeCompare(right.exerciseId, "en"),
    ),
    names: Object.fromEntries(
      Object.entries(names).sort(([left], [right]) => left.localeCompare(right, "en")),
    ),
    exclusions: [...exclusions].sort((left, right) =>
      left.exerciseId.localeCompare(right.exerciseId, "en"),
    ),
  };
  return sha256(Buffer.from(JSON.stringify(canonical), "utf8"));
}

export function parseJsonBuffer(buffer, label) {
  try {
    return JSON.parse(buffer.toString("utf8").replace(/^\uFEFF/u, ""));
  } catch (error) {
    throw new DatasetValidationError(`Could not parse ${label}.`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }
}

export function normalizeText(value) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function normalizeToken(value) {
  return normalizeText(value).toLocaleLowerCase("en");
}

function formatAjvError(error) {
  const at = error.instancePath || "/";
  return `${at}: ${error.message ?? "schema validation failed"}`;
}

function isSafeRelativeMediaPath(value, expectedDirectory, extensionPattern) {
  if (
    typeof value !== "string" ||
    value.includes("\\") ||
    value.includes(":") ||
    value.startsWith("/") ||
    value.includes("//") ||
    path.posix.normalize(value) !== value
  ) {
    return false;
  }

  const segments = value.split("/");
  return (
    segments.length === 2 &&
    segments[0] === expectedDirectory &&
    segments[1].length > 0 &&
    extensionPattern.test(segments[1])
  );
}

export function validateSourceDataset(records, schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  const schemaValid = validateSchema(records);
  const issues = schemaValid
    ? []
    : (validateSchema.errors ?? []).slice(0, 100).map(formatAjvError);

  if (!Array.isArray(records)) {
    throw new DatasetValidationError("The upstream dataset is not an array.", issues);
  }

  const ids = new Set();
  const imageReferences = new Set();
  const animationReferences = new Set();
  const availableLanguages = new Set();
  const equipmentValues = new Set();
  const bodyPartValues = new Set();
  const targetValues = new Set();
  const attributionValues = new Set();
  const incompleteSpanishInstructionIds = [];

  for (const [index, record] of records.entries()) {
    if (record === null || typeof record !== "object" || Array.isArray(record)) {
      continue;
    }

    const prefix = `record ${index}${typeof record.id === "string" ? ` (${record.id})` : ""}`;
    if (typeof record.id === "string") {
      if (ids.has(record.id)) issues.push(`${prefix}: duplicate exercise id`);
      ids.add(record.id);
    }

    if (record.category !== record.body_part) {
      issues.push(`${prefix}: category must mirror body_part`);
    }

    for (const field of [
      "id",
      "name",
      "category",
      "body_part",
      "equipment",
      "muscle_group",
      "target",
      "media_id",
      "image",
      "gif_url",
      "attribution",
      "created_at",
    ]) {
      if (typeof record[field] === "string" && record[field].trim().length === 0) {
        issues.push(`${prefix}: ${field} cannot contain whitespace only`);
      }
    }

    if (!isSafeRelativeMediaPath(record.image, "images", /\.(?:jpe?g|png)$/iu)) {
      issues.push(`${prefix}: unsafe or unsupported image path ${JSON.stringify(record.image)}`);
    }
    if (!isSafeRelativeMediaPath(record.gif_url, "videos", /\.gif$/iu)) {
      issues.push(`${prefix}: unsafe or unsupported animation path ${JSON.stringify(record.gif_url)}`);
    }

    if (typeof record.image === "string" && typeof record.media_id === "string") {
      const expectedStem = `${record.id}-${record.media_id}`;
      if (path.posix.basename(record.image, path.posix.extname(record.image)) !== expectedStem) {
        issues.push(`${prefix}: image filename does not match id-media_id`);
      }
      if (imageReferences.has(record.image)) {
        issues.push(`${prefix}: duplicate image reference ${record.image}`);
      }
      imageReferences.add(record.image);
    }

    if (typeof record.gif_url === "string" && typeof record.media_id === "string") {
      const expectedStem = `${record.id}-${record.media_id}`;
      if (path.posix.basename(record.gif_url, path.posix.extname(record.gif_url)) !== expectedStem) {
        issues.push(`${prefix}: animation filename does not match id-media_id`);
      }
      if (animationReferences.has(record.gif_url)) {
        issues.push(`${prefix}: duplicate animation reference ${record.gif_url}`);
      }
      animationReferences.add(record.gif_url);
    }

    const spanishInstruction = record.instructions?.es;
    const spanishSteps = record.instruction_steps?.es;
    if (
      typeof spanishInstruction !== "string" ||
      spanishInstruction.trim().length === 0 ||
      !Array.isArray(spanishSteps) ||
      spanishSteps.length === 0 ||
      spanishSteps.some((step) => typeof step !== "string" || step.trim().length === 0)
    ) {
      if (typeof record.id === "string") incompleteSpanishInstructionIds.push(record.id);
    }

    for (const language of Object.keys(record.instructions ?? {})) {
      availableLanguages.add(language);
    }
    if (typeof record.equipment === "string") equipmentValues.add(record.equipment);
    if (typeof record.body_part === "string") bodyPartValues.add(record.body_part);
    if (typeof record.target === "string") targetValues.add(record.target);
    if (typeof record.attribution === "string") attributionValues.add(record.attribution);
  }

  for (const language of REQUIRED_LANGUAGES) {
    if (!availableLanguages.has(language)) {
      issues.push(`dataset is missing required instruction language ${language}`);
    }
  }

  if (issues.length > 0) {
    throw new DatasetValidationError("Source dataset validation failed.", issues);
  }

  return {
    totalExercises: records.length,
    duplicateIds: [],
    duplicateImageReferences: [],
    duplicateAnimationReferences: [],
    availableLanguages: [...availableLanguages].sort(),
    equipmentValues: [...equipmentValues].sort(),
    bodyPartValues: [...bodyPartValues].sort(),
    targetValues: [...targetValues].sort(),
    attributionValues: [...attributionValues].sort(),
    incompleteSpanishInstructionIds,
  };
}

export const EQUIPMENT_NORMALIZATION = Object.freeze({
  assisted: "machine",
  band: "resistance_band",
  barbell: "barbell",
  "body weight": "body_weight",
  "bosu ball": "bosu_ball",
  cable: "cable",
  dumbbell: "dumbbell",
  "elliptical machine": "cardio_machine",
  "ez barbell": "barbell",
  hammer: "other",
  kettlebell: "kettlebell",
  "leverage machine": "machine",
  "medicine ball": "medicine_ball",
  "olympic barbell": "barbell",
  "resistance band": "resistance_band",
  roller: "mobility_tool",
  rope: "rope",
  "skierg machine": "cardio_machine",
  "sled machine": "machine",
  "smith machine": "smith_machine",
  "stability ball": "stability_ball",
  "stationary bike": "cardio_machine",
  "stepmill machine": "cardio_machine",
  tire: "tire",
  "trap bar": "barbell",
  "upper body ergometer": "cardio_machine",
  weighted: "weighted",
  "wheel roller": "ab_wheel",
});

export function normalizeExercise(record) {
  const rawEquipment = normalizeToken(record.equipment);
  const equipment = EQUIPMENT_NORMALIZATION[rawEquipment];
  if (!equipment) {
    throw new DatasetValidationError(`No equipment normalization for ${record.id}.`, [
      `Unknown source equipment value: ${record.equipment}`,
    ]);
  }

  return {
    id: record.id,
    sourceName: normalizeText(record.name),
    bodyPart: normalizeToken(record.body_part).replaceAll(" ", "_"),
    category: normalizeToken(record.category).replaceAll(" ", "_"),
    rawEquipment,
    equipment,
    primaryMuscles: [normalizeToken(record.target).replaceAll(" ", "_")],
    muscleGroup: normalizeToken(record.muscle_group).replaceAll(" ", "_"),
    secondaryMuscles: record.secondary_muscles.map((muscle) =>
      normalizeToken(muscle).replaceAll(" ", "_"),
    ),
    instructionsEs: normalizeText(record.instructions.es),
    instructionStepsEs: record.instruction_steps.es.map(normalizeText),
    mediaId: normalizeText(record.media_id),
    sourceImagePath: record.image,
    sourceAnimationPath: record.gif_url,
    attribution: normalizeText(record.attribution),
    createdAt: record.created_at,
  };
}

export function isSafeGeneratedMediaUrl(value) {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  if (/^https?:/iu.test(value) || value.includes("\\") || value.includes("..")) return false;
  return (
    /^\/api\/exercise-media\/(?:images|videos)\/[0-9]{4}-[A-Za-z0-9_-]+\.(?:jpe?g|png|gif)$/u.test(
      value,
    ) ||
    /^\/exercises\/placeholders\/[A-Za-z0-9._-]+\.svg$/u.test(value) ||
    /^\/exercises\/replacements\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif)$/u.test(value)
  );
}
