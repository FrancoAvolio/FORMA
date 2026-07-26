#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DATASET_SOURCE } from "./lib/dataset-config.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argumentIndex = process.argv.indexOf("--destination");
const destination = path.resolve(
  projectRoot,
  argumentIndex === -1 ? ".local-media/source-repo" : process.argv[argumentIndex + 1],
);
const allowedRoot = path.resolve(projectRoot, ".local-media");

if (destination === allowedRoot || !destination.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error(`The pinned source clone must stay inside ${allowedRoot}.`);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(destination, ".git")))) {
  execFileSync(
    "git",
    ["clone", "--filter=blob:none", "--no-checkout", DATASET_SOURCE.repository, destination],
    { stdio: "inherit" },
  );
} else {
  const remote = execFileSync("git", ["-C", destination, "remote", "get-url", "origin"], {
    encoding: "utf8",
  }).trim();
  if (![DATASET_SOURCE.repository, `${DATASET_SOURCE.repository}.git`].includes(remote)) {
    throw new Error(`Refusing to use unexpected source remote ${remote}.`);
  }
}

execFileSync(
  "git",
  ["-C", destination, "fetch", "--depth=1", "origin", DATASET_SOURCE.commit],
  { stdio: "inherit" },
);
execFileSync("git", ["-C", destination, "checkout", "--detach", DATASET_SOURCE.commit], {
  stdio: "inherit",
});
const actualCommit = execFileSync("git", ["-C", destination, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualCommit !== DATASET_SOURCE.commit) throw new Error("Pinned source checkout verification failed.");

console.log(`Pinned source is ready at ${path.relative(projectRoot, destination)}.`);

