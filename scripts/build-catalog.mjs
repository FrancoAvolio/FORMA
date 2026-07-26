#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import MiniSearch from "minisearch";

import {
  CURATED_DIRECTORY,
  DATASET_SOURCE,
  GENERATED_DIRECTORY,
  SOURCE_ATTRIBUTION,
  SOURCE_DIRECTORY,
} from "./lib/dataset-config.mjs";
import {
  normalizeExercise,
  parseJsonBuffer,
  validateSourceDataset,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

async function readJson(relativePath, label = relativePath) {
  return parseJsonBuffer(await readFile(path.join(projectRoot, relativePath)), label);
}

async function atomicJson(relativePath, value) {
  const targetPath = path.join(projectRoot, relativePath);
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (checkOnly) {
    let current;
    try {
      current = await readFile(targetPath, "utf8");
    } catch {
      throw new Error(`Generated artifact is missing: ${relativePath}.`);
    }
    if (current !== serialized) {
      throw new Error(
        `Generated artifact is stale: ${relativePath}. Run node scripts/build-catalog.mjs.`,
      );
    }
    return;
  }
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, serialized);
  await rm(targetPath, { force: true });
  await rename(temporaryPath, targetPath);
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

const records = await readJson(`${SOURCE_DIRECTORY}/exercises.json`);
const schema = await readJson(`${SOURCE_DIRECTORY}/exercises.schema.json`);
const sourceMetadata = await readJson(`${SOURCE_DIRECTORY}/dataset-source.json`);
const metadataDocument = await readJson(`${CURATED_DIRECTORY}/exercise-metadata.json`);
const namesDocument = await readJson(`${CURATED_DIRECTORY}/exercise-display-names.es.json`);
const aliasesDocument = await readJson(`${CURATED_DIRECTORY}/exercise-aliases.json`);
const exclusionsDocument = await readJson(`${CURATED_DIRECTORY}/exercise-exclusions.json`);
const mediaManifest = await readJson(`${GENERATED_DIRECTORY}/media-index.json`);
const sourceReport = validateSourceDataset(records, schema);
const normalizedRecords = records.map(normalizeExercise).sort((left, right) => left.id.localeCompare(right.id));
const metadataById = new Map(
  metadataDocument.records.map((metadata) => [metadata.exerciseId, metadata]),
);
const excludedById = new Map(
  exclusionsDocument.records.map((exclusion) => [exclusion.exerciseId, exclusion]),
);
const mediaById = new Map(mediaManifest.entries.map((entry) => [entry.exerciseId, entry]));

const compactExercises = normalizedRecords.map((record) => {
  const metadata = metadataById.get(record.id) ?? null;
  const exclusion = excludedById.get(record.id) ?? null;
  const media = mediaById.get(record.id) ?? null;
  const displayNameEs = namesDocument.names[record.id] ?? null;
  return {
    id: record.id,
    sourceName: record.sourceName,
    displayName: displayNameEs ?? record.sourceName,
    displayNameEs,
    reviewStatus: metadata ? "approved" : exclusion ? "excluded" : "unreviewed",
    approvedForGeneration: metadata?.approvedForGeneration ?? false,
    bodyPart: record.bodyPart,
    category: record.category,
    rawEquipment: record.rawEquipment,
    equipment: record.equipment,
    requiredEquipment: metadata
      ? [...new Set([record.equipment, ...metadata.additionalEquipment])]
      : [record.equipment],
    primaryMuscles: record.primaryMuscles,
    secondaryMuscles: record.secondaryMuscles,
    muscleGroup: record.muscleGroup,
    difficulty: metadata?.difficulty ?? null,
    movementPattern: metadata?.movementPattern ?? null,
    modality: metadata?.modality ?? null,
    laterality: metadata?.laterality ?? null,
    aliases: aliasesDocument.exerciseAliases[record.id] ?? [],
    mediaAvailable: media !== null,
    hasThumbnail: media?.thumbnail !== undefined,
    hasAnimation: media?.animation !== undefined,
    mediaRef: media ? record.id : null,
  };
});

const exerciseDetails = normalizedRecords.map((record) => {
  const compact = compactExercises.find((item) => item.id === record.id);
  const media = mediaById.get(record.id) ?? null;
  return {
    ...compact,
    instructionsEs: record.instructionsEs,
    instructionStepsEs: record.instructionStepsEs,
    sourceMedia: media
      ? {
          thumbnailFilename: media.thumbnail.filename,
          animationFilename: media.animation.filename,
          attribution: media.attribution,
          protectedMedia: true,
          productionDistribution: "disabled_pending_license_review",
        }
      : null,
    sourceAttribution: SOURCE_ATTRIBUTION,
  };
});

const routineCatalog = normalizedRecords
  .filter((record) => metadataById.has(record.id))
  .map((record) => {
    const metadata = metadataById.get(record.id);
    return {
      id: record.id,
      name: namesDocument.names[record.id],
      sourceName: record.sourceName,
      aliases: aliasesDocument.exerciseAliases[record.id] ?? [],
      equipment: [record.equipment],
      rawEquipment: record.rawEquipment,
      bodyPart: record.bodyPart,
      primaryMuscles: record.primaryMuscles,
      secondaryMuscles: record.secondaryMuscles,
      movementPattern: metadata.movementPattern,
      modality: metadata.modality,
      laterality: metadata.laterality,
      difficulty: metadata.difficulty,
      fatigueCost: metadata.fatigueCost,
      skillRequirement: metadata.skillRequirement,
      defaultRepRange: metadata.defaultRepRange,
      defaultRestSeconds: metadata.defaultRestSeconds,
      substitutionGroup: metadata.substitutionGroup,
      tags: metadata.tags,
      approvedForGeneration: true,
      mediaRef: mediaById.has(record.id) ? record.id : null,
    };
  })
  .map((exercise) => {
    const metadata = metadataById.get(exercise.id);
    return {
      ...exercise,
      equipment: [...new Set([...exercise.equipment, ...(metadata?.additionalEquipment ?? [])])],
    };
  });

const searchOptions = {
  fields: [
    "displayName",
    "sourceName",
    "aliases",
    "bodyPart",
    "rawEquipment",
    "equipment",
    "requiredEquipment",
    "primaryMuscles",
    "secondaryMuscles",
    "movementPattern",
  ],
  storeFields: [
    "id",
    "displayName",
    "reviewStatus",
    "bodyPart",
    "equipment",
    "primaryMuscles",
    "movementPattern",
    "mediaAvailable",
  ],
  searchOptions: { boost: { displayName: 3, sourceName: 2, aliases: 2 }, prefix: true, fuzzy: 0.2 },
};
const search = new MiniSearch(searchOptions);
search.addAll(compactExercises);

const report = {
  schemaVersion: 1,
  dataset: {
    repository: DATASET_SOURCE.repository,
    commit: DATASET_SOURCE.commit,
    commitDate: DATASET_SOURCE.commitDate,
    datasetSha256: sourceMetadata.hashes.datasetSha256,
    totalExercises: records.length,
    duplicateIds: sourceReport.duplicateIds,
    missingRequiredFields: [],
    availableLanguages: sourceReport.availableLanguages,
    equipmentValues: countValues(records.map((record) => record.equipment)),
    bodyPartValues: countValues(records.map((record) => record.body_part)),
    targetValues: countValues(records.map((record) => record.target)),
    exercisesWithSpanishInstructions:
      records.length - sourceReport.incompleteSpanishInstructionIds.length,
    exercisesWithoutCompleteSpanishInstructions: sourceReport.incompleteSpanishInstructionIds,
  },
  curation: {
    implementationReviewSha256: metadataDocument.curationReviewSha256,
    approvedExercises: metadataById.size,
    excludedExercises: excludedById.size,
    unreviewedExercises: records.length - metadataById.size - excludedById.size,
    approvedByMovementPattern: countValues(
      metadataDocument.records.map((metadata) => metadata.movementPattern),
    ),
    approvedByDifficulty: countValues(
      metadataDocument.records.map((metadata) => metadata.difficulty),
    ),
    approvedByCanonicalEquipment: countValues(
      routineCatalog.flatMap((exercise) => exercise.equipment),
    ),
    explicitExclusions: exclusionsDocument.records,
    brokenAliases: [],
    brokenSubstitutionGroups: [],
    generatedSpanishNamesPendingLanguageReview: metadataById.size,
    programmingAssumptionsPendingDomainReview: metadataById.size,
  },
  media: {
    totalFiles: mediaManifest.totals.thumbnails + mediaManifest.totals.animations,
    thumbnailFiles: mediaManifest.totals.thumbnails,
    animationFiles: mediaManifest.totals.animations,
    importedBytes: mediaManifest.totals.bytes,
    inventorySha256: mediaManifest.inventorySha256,
    exercisesWithThumbnails: mediaManifest.entries.filter((entry) => entry.thumbnail).length,
    exercisesWithAnimations: mediaManifest.entries.filter((entry) => entry.animation).length,
    exercisesWithMissingMedia: records.length - mediaManifest.entries.length,
    brokenMediaReferences: [],
    duplicateMediaReferences: [],
    attributionValues: sourceReport.attributionValues,
    productionDistribution: "disabled_pending_license_review",
  },
};

await atomicJson(`${GENERATED_DIRECTORY}/exercises.normalized.json`, {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  exercises: normalizedRecords,
});
await atomicJson(`${GENERATED_DIRECTORY}/exercises.compact.json`, {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  exercises: compactExercises,
});
await atomicJson(`${GENERATED_DIRECTORY}/exercise-details.json`, {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  exercises: exerciseDetails,
});
await atomicJson(`${GENERATED_DIRECTORY}/routine-catalog.json`, {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  exercises: routineCatalog,
});
await atomicJson(`${GENERATED_DIRECTORY}/exercise-index.json`, {
  schemaVersion: 1,
  datasetCommit: DATASET_SOURCE.commit,
  miniSearchOptions: searchOptions,
  serializedIndex: search.toJSON(),
  queryAliases: aliasesDocument.queryAliases,
});
await atomicJson(`${GENERATED_DIRECTORY}/dataset-report.json`, report);

console.log(
  `${checkOnly ? "Validated" : "Built"} ${compactExercises.length} explorer records and ${routineCatalog.length} approved generation records.`,
);
