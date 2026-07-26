#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
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
  SOURCE_DIRECTORY,
} from "./lib/dataset-config.mjs";
import {
  gitBlobObjectId,
  mediaInventoryDigest,
  parseJsonBuffer,
} from "./lib/dataset-pipeline.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function getArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function assertLocalDestination(targetPath) {
  const allowedRoot = path.resolve(projectRoot, ".local-media");
  const resolved = path.resolve(targetPath);
  if (resolved === allowedRoot || !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
    throw new Error(`Refusing to import protected media outside ${allowedRoot}.`);
  }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readPinnedMediaTree(repositoryPath) {
  const objectFormat = execFileSync(
    "git",
    ["-C", repositoryPath, "rev-parse", "--show-object-format"],
    { encoding: "utf8" },
  ).trim();
  if (!["sha1", "sha256"].includes(objectFormat)) {
    throw new Error(`Unsupported Git object format ${objectFormat}.`);
  }

  const tree = execFileSync(
    "git",
    [
      "-C",
      repositoryPath,
      "ls-tree",
      "-r",
      "-z",
      "--full-tree",
      DATASET_SOURCE.commit,
      "--",
      "images",
      "videos",
    ],
    { maxBuffer: 4 * 1024 * 1024 },
  )
    .toString("utf8")
    .split("\0")
    .filter(Boolean);
  const objects = new Map();
  for (const item of tree) {
    const match = /^\d+ blob ([a-f0-9]+)\t(.+)$/u.exec(item);
    if (!match) throw new Error(`Unexpected pinned media tree entry ${JSON.stringify(item)}.`);
    objects.set(match[2], match[1]);
  }
  return { objectFormat, objects };
}

function readGifDimensions(buffer) {
  if (buffer.length < 10 || !["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"))) {
    throw new Error("Invalid GIF header.");
  }
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Invalid JPEG header.");
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) break;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }

  throw new Error("JPEG dimensions were not found.");
}

async function describeAndCopy(
  sourcePath,
  destinationPath,
  kind,
  expectedGitObjectId,
  objectFormat,
) {
  const buffer = await readFile(sourcePath);
  const actualGitObjectId = gitBlobObjectId(buffer, objectFormat);
  if (!expectedGitObjectId || actualGitObjectId !== expectedGitObjectId) {
    throw new Error(
      `Working-tree media does not match the pinned Git blob for ${sourcePath}.`,
    );
  }
  const dimensions = kind === "animation" ? readGifDimensions(buffer) : readJpegDimensions(buffer);
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
  return {
    byteSize: buffer.length,
    sha256: sha256(buffer),
    sourceGitBlob: actualGitObjectId,
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
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
const destinationRoot = path.resolve(
  projectRoot,
  getArgument("--destination", LOCAL_MEDIA_DIRECTORY),
);
assertLocalDestination(destinationRoot);

const actualCommit = execFileSync("git", ["-C", sourceRepository, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualCommit !== DATASET_SOURCE.commit) {
  throw new Error(`Expected source commit ${DATASET_SOURCE.commit}, received ${actualCommit}.`);
}
const pinnedMediaTree = readPinnedMediaTree(sourceRepository);

const datasetPath = path.join(projectRoot, SOURCE_DIRECTORY, "exercises.json");
const records = parseJsonBuffer(await readFile(datasetPath), datasetPath);
const referencedImages = new Set(records.map((record) => record.image));
const referencedAnimations = new Set(records.map((record) => record.gif_url));
const sourceImages = await readdir(path.join(sourceRepository, "images"));
const sourceAnimations = await readdir(path.join(sourceRepository, "videos"));
const unreferencedImages = sourceImages.filter((name) => !referencedImages.has(`images/${name}`));
const unreferencedAnimations = sourceAnimations.filter(
  (name) => !referencedAnimations.has(`videos/${name}`),
);

if (
  sourceImages.length !== DATASET_SOURCE.expected.imageCount ||
  sourceAnimations.length !== DATASET_SOURCE.expected.animationCount ||
  pinnedMediaTree.objects.size !==
    DATASET_SOURCE.expected.imageCount + DATASET_SOURCE.expected.animationCount ||
  unreferencedImages.length > 0 ||
  unreferencedAnimations.length > 0
) {
  throw new Error(
    `Unexpected pinned media inventory: ${sourceImages.length} images, ${sourceAnimations.length} animations, ` +
      `${pinnedMediaTree.objects.size} pinned blobs, ` +
      `${unreferencedImages.length + unreferencedAnimations.length} unreferenced files.`,
  );
}

await rm(destinationRoot, { recursive: true, force: true });
await mkdir(destinationRoot, { recursive: true });

const entries = await mapWithConcurrency(records, 16, async (record) => {
  const imageFilename = path.posix.basename(record.image);
  const animationFilename = path.posix.basename(record.gif_url);
  const thumbnail = await describeAndCopy(
    path.join(sourceRepository, ...record.image.split("/")),
    path.join(destinationRoot, "images", imageFilename),
    "thumbnail",
    pinnedMediaTree.objects.get(record.image),
    pinnedMediaTree.objectFormat,
  );
  const animation = await describeAndCopy(
    path.join(sourceRepository, ...record.gif_url.split("/")),
    path.join(destinationRoot, "videos", animationFilename),
    "animation",
    pinnedMediaTree.objects.get(record.gif_url),
    pinnedMediaTree.objectFormat,
  );

  return {
    exerciseId: record.id,
    mediaId: record.media_id,
    thumbnail: {
      filename: imageFilename,
      sourcePath: record.image,
      localDevelopmentUrl: `/api/exercise-media/images/${imageFilename}`,
      publicProductionUrl: null,
      ...thumbnail,
    },
    animation: {
      filename: animationFilename,
      sourcePath: record.gif_url,
      localDevelopmentUrl: `/api/exercise-media/videos/${animationFilename}`,
      publicProductionUrl: null,
      ...animation,
    },
    attribution: record.attribution,
    canonicalAttribution: MEDIA_ATTRIBUTION,
    source: DATASET_SOURCE.repository,
    protectedMedia: true,
    productionDistribution: "disabled_pending_license_review",
  };
});

entries.sort((left, right) => left.exerciseId.localeCompare(right.exerciseId));
const totalBytes = entries.reduce(
  (sum, entry) => sum + entry.thumbnail.byteSize + entry.animation.byteSize,
  0,
);
if (totalBytes !== DATASET_SOURCE.expected.mediaBytes) {
  throw new Error(
    `Pinned media byte count changed: expected ${DATASET_SOURCE.expected.mediaBytes}, received ${totalBytes}.`,
  );
}
const inventorySha256 = mediaInventoryDigest(entries);
if (inventorySha256 !== DATASET_SOURCE.expected.mediaInventorySha256) {
  throw new Error(
    `Pinned media inventory changed: expected ${DATASET_SOURCE.expected.mediaInventorySha256}, received ${inventorySha256}.`,
  );
}
const manifest = {
  schemaVersion: 2,
  datasetCommit: DATASET_SOURCE.commit,
  sourceGitObjectFormat: pinnedMediaTree.objectFormat,
  inventorySha256,
  delivery: {
    localDevelopment: "private_api_route",
    publicProduction: "disabled_pending_license_review",
    placeholder: "/exercises/placeholders/exercise-media.svg",
  },
  totals: {
    exercises: entries.length,
    thumbnails: entries.length,
    animations: entries.length,
    bytes: totalBytes,
  },
  entries,
};

await atomicWrite(
  path.join(projectRoot, GENERATED_DIRECTORY, "media-index.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await atomicWrite(
  path.join(projectRoot, GENERATED_DIRECTORY, "media-runtime.json"),
  `${JSON.stringify(
    {
      schemaVersion: 1,
      datasetCommit: DATASET_SOURCE.commit,
      delivery: manifest.delivery,
      attribution: MEDIA_ATTRIBUTION,
      entries: entries.map((entry) => ({
        exerciseId: entry.exerciseId,
        thumbnail: {
          filename: entry.thumbnail.filename,
          width: entry.thumbnail.width,
          height: entry.thumbnail.height,
        },
        animation: {
          filename: entry.animation.filename,
          width: entry.animation.width,
          height: entry.animation.height,
        },
      })),
    },
    null,
    2,
  )}\n`,
);
await atomicWrite(
  path.join(destinationRoot, "import-report.json"),
  `${JSON.stringify(
    {
      datasetCommit: DATASET_SOURCE.commit,
      sourceGitObjectFormat: pinnedMediaTree.objectFormat,
      inventorySha256,
      importedEntries: entries.length,
      importedBytes: totalBytes,
      destination: path.relative(projectRoot, destinationRoot).replaceAll("\\", "/"),
      publicProductionAssetsIncluded: false,
    },
    null,
    2,
  )}\n`,
);

const destinationStats = await stat(destinationRoot);
if (!destinationStats.isDirectory()) throw new Error("Local media import destination is not a directory.");

console.log(
  `Imported ${entries.length} JPG thumbnails and GIF animations (${totalBytes} bytes) into ignored local storage.`,
);
