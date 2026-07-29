#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanStagedSourceMedia,
  stageSourceMedia,
} from "./stage-source-media.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const openNextCli = path.join(
  projectRoot,
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "index.js",
);
const authorizedWranglerConfig = path.join(
  projectRoot,
  "wrangler.authorized-media.jsonc",
);
const command = process.argv[2] ?? "build";
const supportedCommands = new Set(["build", "deploy", "preview"]);
const authorizationFlag = "--authorize-owner-source-media";

if (!supportedCommands.has(command)) {
  throw new Error(`Unsupported Cloudflare source-media command: ${command}`);
}
if (!process.argv.includes(authorizationFlag)) {
  throw new Error(
    `Owner-authorized source media is opt-in. Re-run with ${authorizationFlag}.`,
  );
}

const buildEnvironment = {
  ...process.env,
  EXERCISE_MEDIA_MODE: "owner_authorized_source",
  NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA: "true",
  NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA: "false",
};

function runOpenNext(argumentsList) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [openNextCli, ...argumentsList], {
      cwd: projectRoot,
      env: buildEnvironment,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `OpenNext ${argumentsList[0]} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`,
        ),
      );
    });
  });
}

function runMediaValidation() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(projectRoot, "scripts", "validate-media.mjs"),
        "--require-local",
        "--allow-owner-authorized-source",
      ],
      {
        cwd: projectRoot,
        env: buildEnvironment,
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Authorized media validation failed (${signal ? `signal ${signal}` : `exit ${code}`}).`,
        ),
      );
    });
  });
}

console.warn(
  "Building with the repository-owner media authorization; attribution stays visible and licensing review remains documented as pending.",
);
await cleanStagedSourceMedia();
await runOpenNext(["build", "--config", authorizedWranglerConfig]);
const staged = await stageSourceMedia();
console.log(`Validated and staged ${staged.files} source-media files (${staged.bytes} bytes).`);
await runMediaValidation();

if (command === "deploy") {
  try {
    await runOpenNext(["deploy", "--config", authorizedWranglerConfig]);
  } finally {
    await cleanStagedSourceMedia();
  }
} else if (command === "preview") {
  try {
    await runOpenNext(["preview", "--config", authorizedWranglerConfig]);
  } finally {
    await cleanStagedSourceMedia();
  }
}
