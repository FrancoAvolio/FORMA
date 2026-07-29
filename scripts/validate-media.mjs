#!/usr/bin/env node

import { createHash } from "node:crypto";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATASET_SOURCE,
  GENERATED_DIRECTORY,
  LOCAL_MEDIA_DIRECTORY,
  MEDIA_ATTRIBUTION,
  SOURCE_DIRECTORY,
} from "./lib/dataset-config.mjs";
import {
  isSafeGeneratedMediaUrl,
  mediaInventoryDigest,
  parseJsonBuffer,
} from "./lib/dataset-pipeline.mjs";
import { sourceMediaNotice } from "./stage-source-media.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireLocal = process.argv.includes("--require-local");
const allowOwnerAuthorizedSource = process.argv.includes(
  "--allow-owner-authorized-source",
);

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  if (!(await fileExists(root))) return [];
  const output = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, item.name);
    if (item.isDirectory()) output.push(...(await listFiles(absolutePath)));
    if (item.isFile()) output.push(absolutePath);
  }
  return output;
}

const records = parseJsonBuffer(
  await readFile(path.join(projectRoot, SOURCE_DIRECTORY, "exercises.json")),
  "vendored exercises.json",
);
const manifest = parseJsonBuffer(
  await readFile(path.join(projectRoot, GENERATED_DIRECTORY, "media-index.json")),
  "generated media-index.json",
);
const runtimeManifest = parseJsonBuffer(
  await readFile(path.join(projectRoot, GENERATED_DIRECTORY, "media-runtime.json")),
  "generated media-runtime.json",
);
const issues = [];
const recordById = new Map(records.map((record) => [record.id, record]));
const protectedFilenames = new Set();
const protectedHashes = new Set();
const protectedDeploymentPaths = new Map();
const manifestIds = new Set();
const runtimeIds = new Set();
const manifestFilenames = new Set();

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

if (manifest.schemaVersion !== 2) {
  issues.push("protected integrity manifest schema version is not supported");
}
if (manifest.datasetCommit !== DATASET_SOURCE.commit) {
  issues.push("media manifest is not pinned to the approved dataset commit");
}
if (!["sha1", "sha256"].includes(manifest.sourceGitObjectFormat)) {
  issues.push("media manifest has an invalid Git object format");
}
const computedInventorySha256 = mediaInventoryDigest(manifest.entries);
if (
  manifest.inventorySha256 !== computedInventorySha256 ||
  computedInventorySha256 !== DATASET_SOURCE.expected.mediaInventorySha256
) {
  issues.push("media inventory does not match the hard-pinned content digest");
}
if (manifest.entries.length !== records.length) {
  issues.push(`expected ${records.length} media entries, received ${manifest.entries.length}`);
}
if (
  runtimeManifest.datasetCommit !== manifest.datasetCommit ||
  runtimeManifest.attribution !== MEDIA_ATTRIBUTION ||
  runtimeManifest.entries.length !== manifest.entries.length
) {
  issues.push("runtime media manifest does not match the protected integrity manifest");
}
const runtimeById = new Map(runtimeManifest.entries.map((entry) => [entry.exerciseId, entry]));
for (const entry of runtimeManifest.entries) {
  if (runtimeIds.has(entry.exerciseId)) {
    issues.push(`duplicate runtime media entry ${entry.exerciseId}`);
  }
  runtimeIds.add(entry.exerciseId);
}
if (manifest.totals.bytes !== DATASET_SOURCE.expected.mediaBytes) {
  issues.push(
    `expected ${DATASET_SOURCE.expected.mediaBytes} protected media bytes, received ${manifest.totals.bytes}`,
  );
}
const computedManifestBytes = manifest.entries.reduce(
  (total, entry) =>
    total + (entry.thumbnail?.byteSize ?? 0) + (entry.animation?.byteSize ?? 0),
  0,
);
if (
  manifest.totals.exercises !== records.length ||
  manifest.totals.thumbnails !== records.length ||
  manifest.totals.animations !== records.length ||
  manifest.totals.bytes !== computedManifestBytes
) {
  issues.push("media manifest totals do not match its entries and source coverage");
}

for (const entry of manifest.entries) {
  if (manifestIds.has(entry.exerciseId)) {
    issues.push(`duplicate media entry ${entry.exerciseId}`);
  }
  manifestIds.add(entry.exerciseId);
  const record = recordById.get(entry.exerciseId);
  if (!record) {
    issues.push(`media entry ${entry.exerciseId} has no source record`);
    continue;
  }
  const expectedThumbnailFilename = path.posix.basename(record.image);
  const expectedAnimationFilename = path.posix.basename(record.gif_url);
  if (
    entry.thumbnail.filename !== expectedThumbnailFilename ||
    entry.thumbnail.localDevelopmentUrl !==
      `/api/exercise-media/images/${expectedThumbnailFilename}`
  ) {
    issues.push(`${entry.exerciseId}: thumbnail filename or local URL mismatch`);
  }
  if (
    entry.animation.filename !== expectedAnimationFilename ||
    entry.animation.localDevelopmentUrl !==
      `/api/exercise-media/videos/${expectedAnimationFilename}`
  ) {
    issues.push(`${entry.exerciseId}: animation filename or local URL mismatch`);
  }
  const runtimeEntry = runtimeById.get(entry.exerciseId);
  if (
    !runtimeEntry ||
    runtimeEntry.thumbnail?.filename !== entry.thumbnail.filename ||
    runtimeEntry.animation?.filename !== entry.animation.filename ||
    runtimeEntry.thumbnail?.width !== entry.thumbnail.width ||
    runtimeEntry.thumbnail?.height !== entry.thumbnail.height ||
    runtimeEntry.animation?.width !== entry.animation.width ||
    runtimeEntry.animation?.height !== entry.animation.height
  ) {
    issues.push(`${entry.exerciseId}: runtime media entry is missing or stale`);
  }
  if (entry.mediaId !== record.media_id) issues.push(`${entry.exerciseId}: mediaId mismatch`);
  if (entry.thumbnail.sourcePath !== record.image) issues.push(`${entry.exerciseId}: image mismatch`);
  if (entry.animation.sourcePath !== record.gif_url) {
    issues.push(`${entry.exerciseId}: animation mismatch`);
  }
  if (!isSafeGeneratedMediaUrl(entry.thumbnail.localDevelopmentUrl)) {
    issues.push(`${entry.exerciseId}: unsafe local thumbnail URL`);
  }
  if (!isSafeGeneratedMediaUrl(entry.animation.localDevelopmentUrl)) {
    issues.push(`${entry.exerciseId}: unsafe local animation URL`);
  }
  if (entry.thumbnail.publicProductionUrl !== null || entry.animation.publicProductionUrl !== null) {
    issues.push(`${entry.exerciseId}: protected media must not have a public production URL`);
  }
  if (entry.productionDistribution !== "disabled_pending_license_review") {
    issues.push(`${entry.exerciseId}: invalid production-distribution state`);
  }
  if (entry.attribution !== record.attribution || entry.canonicalAttribution !== MEDIA_ATTRIBUTION) {
    issues.push(`${entry.exerciseId}: media attribution was not preserved`);
  }
  for (const [kind, media] of [
    ["thumbnail", entry.thumbnail],
    ["animation", entry.animation],
  ]) {
    if (!Number.isInteger(media.byteSize) || media.byteSize <= 0) {
      issues.push(`${entry.exerciseId}: invalid ${kind} byte size`);
    }
    if (!/^[a-f0-9]{64}$/u.test(media.sha256)) {
      issues.push(`${entry.exerciseId}: invalid ${kind} hash`);
    }
    const expectedGitObjectIdLength =
      manifest.sourceGitObjectFormat === "sha256" ? 64 : 40;
    if (
      typeof media.sourceGitBlob !== "string" ||
      media.sourceGitBlob.length !== expectedGitObjectIdLength ||
      !/^[a-f0-9]+$/u.test(media.sourceGitBlob)
    ) {
      issues.push(`${entry.exerciseId}: invalid ${kind} pinned Git blob id`);
    }
    if (media.width !== 180 || media.height !== 180) {
      issues.push(`${entry.exerciseId}: unexpected ${kind} dimensions ${media.width}x${media.height}`);
    }
    protectedHashes.add(media.sha256);
  }
  for (const filename of [entry.thumbnail.filename, entry.animation.filename]) {
    if (manifestFilenames.has(filename)) {
      issues.push(`${entry.exerciseId}: duplicate protected filename ${filename}`);
    }
    manifestFilenames.add(filename);
  }
  protectedFilenames.add(entry.thumbnail.filename);
  protectedFilenames.add(entry.animation.filename);
  protectedDeploymentPaths.set(
    path.normalize(
      path.join(
        ".open-next",
        "assets",
        "exercises",
        "source-media",
        "images",
        entry.thumbnail.filename,
      ),
    ),
    entry.thumbnail.sha256,
  );
  protectedDeploymentPaths.set(
    path.normalize(
      path.join(
        ".open-next",
        "assets",
        "exercises",
        "source-media",
        "videos",
        entry.animation.filename,
      ),
    ),
    entry.animation.sha256,
  );

  if (requireLocal) {
    const imagePath = path.join(
      projectRoot,
      LOCAL_MEDIA_DIRECTORY,
      "images",
      entry.thumbnail.filename,
    );
    const animationPath = path.join(
      projectRoot,
      LOCAL_MEDIA_DIRECTORY,
      "videos",
      entry.animation.filename,
    );
    for (const [kind, filePath, expected] of [
      ["thumbnail", imagePath, entry.thumbnail],
      ["animation", animationPath, entry.animation],
    ]) {
      if (!(await fileExists(filePath))) {
        issues.push(`${entry.exerciseId}: local ${kind} is missing`);
        continue;
      }
      const fileStats = await stat(filePath);
      const buffer = await readFile(filePath);
      if (fileStats.size !== expected.byteSize || sha256(buffer) !== expected.sha256) {
        issues.push(`${entry.exerciseId}: local ${kind} bytes do not match the pinned manifest`);
      }
    }
  }
}

for (const record of records) {
  if (!manifestIds.has(record.id)) issues.push(`${record.id}: protected media entry is missing`);
  if (!runtimeIds.has(record.id)) issues.push(`${record.id}: runtime media entry is missing`);
}
for (const id of runtimeIds) {
  if (!recordById.has(id)) issues.push(`${id}: runtime media entry has no source record`);
}

const authorizedDeploymentFiles = new Set();
for (const artifactRoot of ["public", ".next", ".open-next", "out"]) {
  for (const filePath of await listFiles(path.join(projectRoot, artifactRoot))) {
    const relativePath = path.normalize(path.relative(projectRoot, filePath));
    const artifactHash = sha256(await readFile(filePath));
    const expectedAuthorizedHash = protectedDeploymentPaths.get(relativePath);
    if (expectedAuthorizedHash) {
      if (!allowOwnerAuthorizedSource) {
        continue;
      }
      if (artifactHash !== expectedAuthorizedHash) {
        issues.push(`owner-authorized production media hash mismatch: ${relativePath}`);
      } else {
        authorizedDeploymentFiles.add(relativePath);
      }
      continue;
    }
    if (protectedFilenames.has(path.basename(filePath))) {
      issues.push(
        `protected Gym Visual binary exists outside its owner-authorized deployment path: ${relativePath}`,
      );
      continue;
    }
    if (protectedHashes.has(artifactHash)) {
      issues.push(
        `renamed protected Gym Visual binary exists outside its owner-authorized deployment path: ${relativePath}`,
      );
    }
  }
}

const authorizedDeploymentRoot = path.join(
  projectRoot,
  ".open-next",
  "assets",
  "exercises",
  "source-media",
);
const stagedDeploymentPaths = new Set(
  (await listFiles(authorizedDeploymentRoot)).map((filePath) =>
    path.normalize(path.relative(projectRoot, filePath)),
  ),
);

if (stagedDeploymentPaths.size > 0 && !allowOwnerAuthorizedSource) {
  issues.push(
    `source-media deployment bundle is present without --allow-owner-authorized-source (${stagedDeploymentPaths.size} files)`,
  );
}

if (allowOwnerAuthorizedSource) {
  const expectedDeploymentPaths = new Set([
    ...protectedDeploymentPaths.keys(),
    path.normalize(
      path.join(
        ".open-next",
        "assets",
        "exercises",
        "source-media",
        "NOTICE.txt",
      ),
    ),
  ]);
  const unexpectedPaths = [...stagedDeploymentPaths].filter(
    (filePath) => !expectedDeploymentPaths.has(filePath),
  );
  const missingPaths = [...expectedDeploymentPaths].filter(
    (filePath) => !stagedDeploymentPaths.has(filePath),
  );
  if (unexpectedPaths.length > 0 || missingPaths.length > 0) {
    issues.push(
      `owner-authorized deployment whitelist mismatch: expected ${expectedDeploymentPaths.size}, received ${stagedDeploymentPaths.size}, missing ${missingPaths.length}, unexpected ${unexpectedPaths.length}`,
    );
  }
  const noticePath = path.join(authorizedDeploymentRoot, "NOTICE.txt");
  if (
    (await fileExists(noticePath)) &&
    (await readFile(noticePath, "utf8")) !== sourceMediaNotice()
  ) {
    issues.push("owner-authorized source-media NOTICE.txt is missing or modified");
  }
  if (authorizedDeploymentFiles.size !== protectedDeploymentPaths.size) {
    issues.push(
      `owner-authorized production media bundle is incomplete: expected ${protectedDeploymentPaths.size}, received ${authorizedDeploymentFiles.size}`,
    );
  }
}

if (issues.length > 0) {
  throw new Error(`Media validation failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
}

console.log(
  `Validated ${manifest.entries.length} media relationships${
    allowOwnerAuthorizedSource && authorizedDeploymentFiles.size > 0
      ? `; owner-authorized production bundle contains ${authorizedDeploymentFiles.size} pinned files and licensing review remains pending`
      : "; current build artifacts remain binary-free"
  }${requireLocal ? "; local import is complete" : ""}.`,
);
