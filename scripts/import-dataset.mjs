#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DATASET_SOURCE, SOURCE_DIRECTORY } from "./lib/dataset-config.mjs";
import {
  parseJsonBuffer,
  sha256,
  validateSourceDataset,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function readPinnedBlob(repositoryPath, sourcePath) {
  return execFileSync(
    "git",
    ["-C", repositoryPath, "cat-file", "blob", `${DATASET_SOURCE.commit}:${sourcePath}`],
    { maxBuffer: 64 * 1024 * 1024 },
  );
}

async function atomicWrite(targetPath, contents) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, contents);
  await rm(targetPath, { force: true });
  await rename(temporaryPath, targetPath);
}

const sourceRepository = path.resolve(
  projectRoot,
  getArgument("--source", ".local-media/source-repo"),
);
const actualCommit = execFileSync("git", ["-C", sourceRepository, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();

if (actualCommit !== DATASET_SOURCE.commit) {
  throw new Error(`Expected source commit ${DATASET_SOURCE.commit}, received ${actualCommit}.`);
}

const datasetBuffer = readPinnedBlob(sourceRepository, DATASET_SOURCE.sourcePaths.dataset);
const schemaBuffer = readPinnedBlob(sourceRepository, DATASET_SOURCE.sourcePaths.schema);
const licenseBuffer = readPinnedBlob(sourceRepository, DATASET_SOURCE.sourcePaths.license);
const noticeBuffer = readPinnedBlob(sourceRepository, DATASET_SOURCE.sourcePaths.notice);
const actualHashes = {
  datasetSha256: sha256(datasetBuffer),
  schemaSha256: sha256(schemaBuffer),
  licenseSha256: sha256(licenseBuffer),
  noticeSha256: sha256(noticeBuffer),
};
for (const [field, expectedHash] of Object.entries(DATASET_SOURCE.expected.hashes)) {
  if (actualHashes[field] !== expectedHash) {
    throw new Error(`Pinned ${field} changed: expected ${expectedHash}, received ${actualHashes[field]}.`);
  }
}
const records = parseJsonBuffer(datasetBuffer, "pinned exercises.json");
const schema = parseJsonBuffer(schemaBuffer, "pinned exercises.schema.json");
const report = validateSourceDataset(records, schema);

if (report.totalExercises !== DATASET_SOURCE.expected.exerciseCount) {
  throw new Error(
    `Pinned dataset count changed: expected ${DATASET_SOURCE.expected.exerciseCount}, received ${report.totalExercises}.`,
  );
}

const outputRoot = path.join(projectRoot, SOURCE_DIRECTORY);
await atomicWrite(path.join(outputRoot, "exercises.json"), datasetBuffer);
await atomicWrite(path.join(outputRoot, "exercises.schema.json"), schemaBuffer);
await atomicWrite(path.join(outputRoot, "upstream", "LICENSE"), licenseBuffer);
await atomicWrite(path.join(outputRoot, "upstream", "NOTICE.md"), noticeBuffer);
await atomicWrite(
  path.join(outputRoot, "dataset-source.json"),
  `${JSON.stringify(
    {
      repository: DATASET_SOURCE.repository,
      commit: DATASET_SOURCE.commit,
      commitDate: DATASET_SOURCE.commitDate,
      sourcePaths: DATASET_SOURCE.sourcePaths,
      hashes: actualHashes,
      expectedCounts: {
        exerciseCount: DATASET_SOURCE.expected.exerciseCount,
        imageCount: DATASET_SOURCE.expected.imageCount,
        animationCount: DATASET_SOURCE.expected.animationCount,
        mediaBytes: DATASET_SOURCE.expected.mediaBytes,
      },
    },
    null,
    2,
  )}\n`,
);

console.log(
  `Imported ${report.totalExercises} immutable records from ${DATASET_SOURCE.commit}.`,
);
