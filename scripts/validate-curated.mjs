#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CURATED_DIRECTORY, DATASET_SOURCE, SOURCE_DIRECTORY } from "./lib/dataset-config.mjs";
import {
  curationReviewDigest,
  isSafeGeneratedMediaUrl,
  parseJsonBuffer,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const safeReplacementUrl =
  /^\/exercises\/replacements\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif)$/u;

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
const sourceRecords = parseJsonBuffer(
  await readFile(path.join(projectRoot, SOURCE_DIRECTORY, "exercises.json")),
  "vendored exercises.json",
);
const sourceIds = new Set(sourceRecords.map((record) => record.id));
const curatedRoot = path.join(projectRoot, CURATED_DIRECTORY);
const metadataDocument = parseJsonBuffer(
  await readFile(path.join(curatedRoot, "exercise-metadata.json")),
  "exercise-metadata.json",
);
const namesDocument = parseJsonBuffer(
  await readFile(path.join(curatedRoot, "exercise-display-names.es.json")),
  "exercise-display-names.es.json",
);
const aliasesDocument = parseJsonBuffer(
  await readFile(path.join(curatedRoot, "exercise-aliases.json")),
  "exercise-aliases.json",
);
const exclusionsDocument = parseJsonBuffer(
  await readFile(path.join(curatedRoot, "exercise-exclusions.json")),
  "exercise-exclusions.json",
);
const overridesDocument = parseJsonBuffer(
  await readFile(path.join(curatedRoot, "exercise-media-overrides.json")),
  "exercise-media-overrides.json",
);

function normalizeAliasValue(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[_-]+/gu, " ")
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

const searchableValues = new Set(
  sourceRecords.flatMap((record) =>
    [
      record.name,
      record.body_part,
      record.equipment,
      record.target,
      record.muscle_group,
      ...record.secondary_muscles,
    ].map(normalizeAliasValue),
  ),
);

const issues = [];
const computedCurationReviewSha256 = curationReviewDigest({
  records: metadataDocument.records ?? [],
  names: namesDocument.names ?? {},
  exclusions: exclusionsDocument.records ?? [],
});
if (
  computedCurationReviewSha256 !== DATASET_SOURCE.expected.curationReviewSha256 ||
  metadataDocument.curationReviewSha256 !== computedCurationReviewSha256 ||
  namesDocument.curationReviewSha256 !== computedCurationReviewSha256 ||
  exclusionsDocument.curationReviewSha256 !== computedCurationReviewSha256
) {
  issues.push("curated records do not match the pinned implementation-review digest");
}
const allowed = {
  difficulty: new Set(["beginner", "intermediate", "advanced"]),
  movementPattern: new Set([
    "horizontal_push",
    "vertical_push",
    "horizontal_pull",
    "vertical_pull",
    "squat",
    "hinge",
    "lunge",
    "carry",
    "core",
    "isolation",
    "cardio",
  ]),
  modality: new Set(["compound", "isolation"]),
  laterality: new Set(["bilateral", "unilateral"]),
  fatigueCost: new Set(["low", "medium", "high"]),
  skillRequirement: new Set(["low", "medium", "high"]),
};
const allowedAdditionalEquipment = new Set([
  "bench",
  "band_anchor",
  "barbell_rack",
  "cable",
  "dip_bars",
  "glute_ham_developer",
  "hyperextension_bench",
  "machine",
  "preacher_bench",
  "pull_up_bar",
  "smith_machine",
  "stability_ball",
  "step_platform",
]);

for (const document of [
  metadataDocument,
  namesDocument,
  aliasesDocument,
  exclusionsDocument,
  overridesDocument,
]) {
  if (document.datasetCommit !== DATASET_SOURCE.commit) {
    issues.push("a curated document is not pinned to the approved dataset commit");
  }
}

if (!Array.isArray(metadataDocument.records)) issues.push("metadata records must be an array");
const metadataIds = new Set();
const substitutionGroups = new Map();
for (const record of metadataDocument.records ?? []) {
  if (!sourceIds.has(record.exerciseId)) issues.push(`${record.exerciseId}: curated id does not exist`);
  if (metadataIds.has(record.exerciseId)) issues.push(`${record.exerciseId}: duplicate curated metadata`);
  metadataIds.add(record.exerciseId);
  if (record.approvedForGeneration !== true) {
    issues.push(`${record.exerciseId}: curated generation record must be explicitly approved`);
  }
  for (const field of Object.keys(allowed)) {
    if (!allowed[field].has(record[field])) issues.push(`${record.exerciseId}: invalid ${field}`);
  }
  for (const [field, minimum, maximum] of [
    ["defaultRepRange", 1, 100],
    ["defaultRestSeconds", 15, 600],
  ]) {
    const range = record[field];
    if (
      !Array.isArray(range) ||
      range.length !== 2 ||
      !range.every(Number.isInteger) ||
      range[0] < minimum ||
      range[1] > maximum ||
      range[0] > range[1]
    ) {
      issues.push(`${record.exerciseId}: invalid ${field}`);
    }
  }
  if (
    !Array.isArray(record.tags) ||
    record.tags.length === 0 ||
    record.tags.some(
      (tag) => typeof tag !== "string" || !/^[a-z][a-z0-9_]*$/u.test(tag),
    ) ||
    new Set(record.tags).size !== record.tags.length
  ) {
    issues.push(`${record.exerciseId}: tags must be unique non-empty slugs`);
  }
  if (
    !Array.isArray(record.additionalEquipment) ||
    record.additionalEquipment.some(
      (item) =>
        typeof item !== "string" || !allowedAdditionalEquipment.has(item),
    ) ||
    new Set(record.additionalEquipment).size !== record.additionalEquipment.length
  ) {
    issues.push(`${record.exerciseId}: invalid additionalEquipment`);
  }
  if (typeof record.substitutionGroup !== "string" || record.substitutionGroup.length === 0) {
    issues.push(`${record.exerciseId}: substitution group is required`);
  } else {
    const ids = substitutionGroups.get(record.substitutionGroup) ?? [];
    ids.push(record.exerciseId);
    substitutionGroups.set(record.substitutionGroup, ids);
  }
}

if (metadataIds.size < 100 || metadataIds.size > 200) {
  issues.push(`approved curated count ${metadataIds.size} must remain between 100 and 200`);
}
if (metadataDocument.approvedCount !== metadataIds.size) {
  issues.push("approvedCount does not match metadata records");
}
for (const [group, ids] of substitutionGroups) {
  if (ids.length < 2) issues.push(`approved substitution group ${group} has no alternative`);
}

const displayNames = new Set();
for (const id of metadataIds) {
  const name = namesDocument.names?.[id];
  if (typeof name !== "string" || name.trim().length === 0) {
    issues.push(`${id}: Spanish display name is missing`);
  } else if (displayNames.has(name.toLocaleLowerCase("es"))) {
    issues.push(`${id}: duplicate approved Spanish display name ${name}`);
  } else {
    displayNames.add(name.toLocaleLowerCase("es"));
  }
  const aliases = aliasesDocument.exerciseAliases?.[id];
  if (!Array.isArray(aliases) || aliases.length === 0 || aliases.some((alias) => !alias.trim())) {
    issues.push(`${id}: aliases are missing or invalid`);
  }
}
for (const id of Object.keys(namesDocument.names ?? {})) {
  if (!metadataIds.has(id)) issues.push(`${id}: display name references an uncurated id`);
}
for (const id of Object.keys(aliasesDocument.exerciseAliases ?? {})) {
  if (!metadataIds.has(id)) issues.push(`${id}: exercise aliases reference an uncurated id`);
}
for (const [alias, targets] of Object.entries(aliasesDocument.queryAliases ?? {})) {
  if (!alias.trim() || !Array.isArray(targets) || targets.length === 0 || targets.some((item) => !item.trim())) {
    issues.push(`broken query alias ${JSON.stringify(alias)}`);
  }
  for (const target of Array.isArray(targets) ? targets : []) {
    const normalizedTarget = normalizeAliasValue(target);
    const resolves = [...searchableValues].some(
      (value) =>
        value === normalizedTarget ||
        value.includes(normalizedTarget) ||
        normalizedTarget.includes(value),
    );
    const resolvesThroughMetadata = (metadataDocument.records ?? []).some((record) =>
      [...(record.tags ?? []), ...(record.additionalEquipment ?? []), record.movementPattern]
        .map(normalizeAliasValue)
        .includes(normalizedTarget),
    );
    if (!resolves && !resolvesThroughMetadata) {
      issues.push(`query alias ${JSON.stringify(alias)} has unresolved target ${JSON.stringify(target)}`);
    }
  }
}

const exclusionIds = new Set();
for (const exclusion of exclusionsDocument.records ?? []) {
  if (!sourceIds.has(exclusion.exerciseId)) issues.push(`${exclusion.exerciseId}: excluded id does not exist`);
  if (metadataIds.has(exclusion.exerciseId)) issues.push(`${exclusion.exerciseId}: id is approved and excluded`);
  if (exclusionIds.has(exclusion.exerciseId)) issues.push(`${exclusion.exerciseId}: duplicate exclusion`);
  exclusionIds.add(exclusion.exerciseId);
  if (typeof exclusion.reason !== "string" || !exclusion.reason.trim()) {
    issues.push(`${exclusion.exerciseId}: exclusion reason is required`);
  }
}

for (const [id, override] of Object.entries(overridesDocument.overrides ?? {})) {
  if (!sourceIds.has(id)) issues.push(`${id}: media override id does not exist`);
  if (!override || typeof override !== "object") {
    issues.push(`${id}: media override must be an object`);
    continue;
  }
  if (
    typeof override.thumbnailUrl !== "string" ||
    !safeReplacementUrl.test(override.thumbnailUrl) ||
    !isSafeGeneratedMediaUrl(override.thumbnailUrl)
  ) {
    issues.push(`${id}: safe replacement thumbnail URL is required`);
  }
  if (
    override.animationUrl !== undefined &&
    override.animationUrl !== null &&
    (typeof override.animationUrl !== "string" ||
      !safeReplacementUrl.test(override.animationUrl) ||
      !isSafeGeneratedMediaUrl(override.animationUrl))
  ) {
    issues.push(`${id}: unsafe replacement animation URL`);
  }
  for (const [field, value] of [
    ["attribution", override.attribution],
    ["licenseReference", override.licenseReference],
  ]) {
    if (typeof value !== "string" || !value.trim()) {
      issues.push(`${id}: replacement ${field} is required`);
    }
  }
  for (const value of [override.thumbnailUrl, override.animationUrl]) {
    if (typeof value !== "string" || !safeReplacementUrl.test(value)) continue;
    const assetPath = path.join(projectRoot, "public", ...value.slice(1).split("/"));
    if (!(await fileExists(assetPath))) {
      issues.push(`${id}: replacement asset is missing at ${value}`);
    }
  }
}

if (issues.length > 0) {
  throw new Error(`Curated metadata validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
}

console.log(
  `Validated ${metadataIds.size} approved exercises, ${substitutionGroups.size} substitution groups, and ${exclusionIds.size} explicit exclusions.`,
);
