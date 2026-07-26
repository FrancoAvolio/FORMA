#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

const port = 3001;
const baseUrl = `http://localhost:${port}`;
const nextBinary = path.resolve("node_modules", "next", "dist", "bin", "next");
const playwrightBinary = path.resolve(
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);

const server = spawn(process.execPath, [nextBinary, "dev", "--port", String(port)], {
  stdio: "inherit",
  env: {
    ...process.env,
    AI_PROVIDER: "mock",
    EXERCISE_MEDIA_MODE: "disabled",
    NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA: "false",
    NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA: "false",
  },
});

async function waitUntilReady() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`The disabled-media server exited with ${server.exitCode}.`);
    }
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Timed out waiting for the disabled-media fixture server.");
}

try {
  await waitUntilReady();
  const tests = spawn(
    process.execPath,
    [
      playwrightBinary,
      "test",
      "--project=desktop-chromium",
      "--grep=disabled-media fixture",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseUrl,
        PLAYWRIGHT_EXPECT_DISABLED_MEDIA: "true",
      },
    },
  );
  const exitCode = await new Promise((resolve) => tests.once("exit", resolve));
  if (exitCode !== 0) process.exitCode = typeof exitCode === "number" ? exitCode : 1;
} finally {
  server.kill("SIGTERM");
}

