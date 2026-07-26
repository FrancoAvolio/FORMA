#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const [script, args] of [
  ["scripts/build-catalog.mjs", ["--check"]],
  ["scripts/audit-catalog.mjs", ["--check"]],
]) {
  execFileSync(process.execPath, [path.join(projectRoot, script), ...args], {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

console.log("Validated generated catalog and audit freshness without modifying files.");
