#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cleanStagedSourceMedia } from "./stage-source-media.mjs";

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
const defaultWranglerConfig = path.join(projectRoot, "wrangler.jsonc");
const command = process.argv[2] ?? "build";
const supportedCommands = new Set(["build", "deploy", "preview"]);

if (!supportedCommands.has(command)) {
  throw new Error(`Unsupported default Cloudflare command: ${command}`);
}

const buildEnvironment = {
  ...process.env,
  EXERCISE_MEDIA_MODE: "disabled",
  NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA: "false",
  NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA: "false",
};

function runNode(argumentsList, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, argumentsList, {
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
          `${label} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`,
        ),
      );
    });
  });
}

function runOpenNext(argumentsList) {
  return runNode([openNextCli, ...argumentsList], `OpenNext ${argumentsList[0]}`);
}

await cleanStagedSourceMedia();
await runOpenNext(["build", "--config", defaultWranglerConfig]);
await runNode(
  [path.join(projectRoot, "scripts", "validate-media.mjs")],
  "Fail-closed media validation",
);

if (command === "deploy") {
  await runOpenNext(["deploy", "--config", defaultWranglerConfig]);
} else if (command === "preview") {
  await runOpenNext(["preview", "--config", defaultWranglerConfig]);
}
