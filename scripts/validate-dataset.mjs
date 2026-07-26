#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DATASET_SOURCE, SOURCE_DIRECTORY } from "./lib/dataset-config.mjs";
import {
  parseJsonBuffer,
  sha256,
  validateSourceDataset,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(projectRoot, SOURCE_DIRECTORY);
const datasetBuffer = await readFile(path.join(sourceRoot, "exercises.json"));
const schemaBuffer = await readFile(path.join(sourceRoot, "exercises.schema.json"));
const licenseBuffer = await readFile(path.join(sourceRoot, "upstream", "LICENSE"));
const noticeBuffer = await readFile(path.join(sourceRoot, "upstream", "NOTICE.md"));
const sourceMetadata = parseJsonBuffer(
  await readFile(path.join(sourceRoot, "dataset-source.json")),
  "dataset-source.json",
);

const issues = [];
if (sourceMetadata.repository !== DATASET_SOURCE.repository) issues.push("repository URL changed");
if (sourceMetadata.commit !== DATASET_SOURCE.commit) issues.push("dataset commit changed");
if (sourceMetadata.commitDate !== DATASET_SOURCE.commitDate) issues.push("commit date changed");
for (const [field, buffer] of [
  ["datasetSha256", datasetBuffer],
  ["schemaSha256", schemaBuffer],
  ["licenseSha256", licenseBuffer],
  ["noticeSha256", noticeBuffer],
]) {
  const actualHash = sha256(buffer);
  if (sourceMetadata.hashes[field] !== actualHash) issues.push(`${field} does not match vendored bytes`);
  if (DATASET_SOURCE.expected.hashes[field] !== actualHash) {
    issues.push(`${field} does not match the hard-pinned Git blob hash`);
  }
}
if (issues.length > 0) {
  throw new Error(`Pinned source integrity failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
}

const records = parseJsonBuffer(datasetBuffer, "vendored exercises.json");
const schema = parseJsonBuffer(schemaBuffer, "vendored exercises.schema.json");
const report = validateSourceDataset(records, schema);
if (report.totalExercises !== DATASET_SOURCE.expected.exerciseCount) {
  throw new Error(
    `Expected ${DATASET_SOURCE.expected.exerciseCount} exercises, received ${report.totalExercises}.`,
  );
}

console.log(
  `Validated ${report.totalExercises} immutable records at ${DATASET_SOURCE.commit}; all strict structural invariants pass.`,
);
