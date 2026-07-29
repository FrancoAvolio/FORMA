#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DATASET_SOURCE,
  GENERATED_DIRECTORY,
  LOCAL_MEDIA_DIRECTORY,
  MEDIA_ATTRIBUTION,
} from "./lib/dataset-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openNextAssetsRoot = path.join(projectRoot, ".open-next", "assets");
const stagedRoot = path.join(
  openNextAssetsRoot,
  "exercises",
  "source-media",
);
const noticeFilename = "NOTICE.txt";
const filenameRule = /^[0-9]{4}-[A-Za-z0-9_-]+\.(?:gif|jpg)$/u;

function assertSafeStagingTarget() {
  const expected = path.join(
    projectRoot,
    ".open-next",
    "assets",
    "exercises",
    "source-media",
  );
  if (stagedRoot !== expected || !stagedRoot.startsWith(openNextAssetsRoot + path.sep)) {
    throw new Error("Refusing to operate outside the exact OpenNext source-media directory.");
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sourceMediaNotice() {
  return [
    "FORMA source exercise media bundle",
    `Dataset commit: ${DATASET_SOURCE.commit}`,
    `Inventory SHA-256: ${DATASET_SOURCE.expected.mediaInventorySha256}`,
    `Attribution: ${MEDIA_ATTRIBUTION}`,
    "Deployment authorized by the repository owner for limited personal use.",
    "Public/commercial media permission has not been represented as completed.",
    "",
  ].join("\n");
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(root) {
  if (!(await exists(root))) return [];
  const files = [];
  for (const item of await readdir(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, item.name);
    if (item.isDirectory()) files.push(...(await listFiles(absolutePath)));
    if (item.isFile()) files.push(absolutePath);
  }
  return files;
}

async function mapConcurrent(items, concurrency, callback) {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await callback(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

async function readManifest() {
  const manifestPath = path.join(
    projectRoot,
    GENERATED_DIRECTORY,
    "media-index.json",
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (
    manifest.datasetCommit !== DATASET_SOURCE.commit ||
    manifest.inventorySha256 !== DATASET_SOURCE.expected.mediaInventorySha256 ||
    manifest.entries?.length !== DATASET_SOURCE.expected.exerciseCount ||
    manifest.totals?.bytes !== DATASET_SOURCE.expected.mediaBytes
  ) {
    throw new Error("The media manifest is not the pinned, validated dataset inventory.");
  }
  return manifest;
}

function buildTasks(manifest) {
  const filenames = new Set();
  const tasks = [];
  for (const entry of manifest.entries) {
    for (const [directory, media, extension] of [
      ["images", entry.thumbnail, ".jpg"],
      ["videos", entry.animation, ".gif"],
    ]) {
      const filename = media?.filename;
      if (
        typeof filename !== "string" ||
        !filenameRule.test(filename) ||
        path.extname(filename) !== extension ||
        path.basename(filename) !== filename ||
        filenames.has(filename)
      ) {
        throw new Error(`Unsafe or duplicate media filename for exercise ${entry.exerciseId}.`);
      }
      filenames.add(filename);
      tasks.push({
        directory,
        filename,
        byteSize: media.byteSize,
        hash: media.sha256,
      });
    }
  }
  return tasks;
}

export async function cleanStagedSourceMedia() {
  assertSafeStagingTarget();
  await rm(stagedRoot, { recursive: true, force: true });
}

export async function verifyStagedSourceMedia() {
  assertSafeStagingTarget();
  const manifest = await readManifest();
  const tasks = buildTasks(manifest);
  const expected = new Map(
    tasks.map((task) => [
      path.normalize(path.join(task.directory, task.filename)),
      task,
    ]),
  );
  expected.set(noticeFilename, { notice: true });

  const stagedFiles = await listFiles(stagedRoot);
  if (stagedFiles.length !== expected.size) {
    throw new Error(
      `Source-media staging whitelist mismatch: expected ${expected.size} files, received ${stagedFiles.length}.`,
    );
  }

  await mapConcurrent(stagedFiles, 16, async (filePath) => {
    const relativePath = path.normalize(path.relative(stagedRoot, filePath));
    const expectedFile = expected.get(relativePath);
    if (!expectedFile) {
      throw new Error(`Unexpected file in source-media staging: ${relativePath}.`);
    }
    const buffer = await readFile(filePath);
    if (expectedFile.notice) {
      if (buffer.toString("utf8") !== sourceMediaNotice()) {
        throw new Error("The staged source-media notice is missing or modified.");
      }
      return;
    }
    if (buffer.length !== expectedFile.byteSize || sha256(buffer) !== expectedFile.hash) {
      throw new Error(`Staged media validation failed for ${relativePath}.`);
    }
  });

  return {
    files: tasks.length,
    bytes: tasks.reduce((total, task) => total + task.byteSize, 0),
    target: stagedRoot,
  };
}

export async function stageSourceMedia() {
  assertSafeStagingTarget();
  if (!(await exists(openNextAssetsRoot))) {
    throw new Error("OpenNext assets are missing. Build the Worker before staging media.");
  }

  const manifest = await readManifest();
  const tasks = buildTasks(manifest);
  await cleanStagedSourceMedia();
  await Promise.all([
    mkdir(path.join(stagedRoot, "images"), { recursive: true }),
    mkdir(path.join(stagedRoot, "videos"), { recursive: true }),
  ]);

  await mapConcurrent(tasks, 16, async (task) => {
    const sourcePath = path.join(
      projectRoot,
      LOCAL_MEDIA_DIRECTORY,
      task.directory,
      task.filename,
    );
    const destinationPath = path.join(stagedRoot, task.directory, task.filename);
    const [sourceStats, buffer] = await Promise.all([
      stat(sourcePath),
      readFile(sourcePath),
    ]);
    if (sourceStats.size !== task.byteSize || sha256(buffer) !== task.hash) {
      throw new Error(`Pinned media validation failed for ${task.filename}.`);
    }
    await writeFile(destinationPath, buffer);
  });

  await writeFile(path.join(stagedRoot, noticeFilename), sourceMediaNotice(), "utf8");
  return verifyStagedSourceMedia();
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const command = process.argv[2] ?? "stage";
  if (command === "clean") {
    await cleanStagedSourceMedia();
    console.log("Removed the staged source-media bundle.");
  } else if (command === "stage") {
    const result = await stageSourceMedia();
    console.log(
      `Staged ${result.files} validated media files (${result.bytes} bytes) in ${path.relative(projectRoot, result.target)}.`,
    );
  } else if (command === "verify") {
    const result = await verifyStagedSourceMedia();
    console.log(
      `Verified ${result.files} staged media files (${result.bytes} bytes).`,
    );
  } else {
    throw new Error(`Unknown source-media staging command: ${command}`);
  }
}
