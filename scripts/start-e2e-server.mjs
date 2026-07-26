#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

const nextBinary = path.resolve("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBinary, "dev"], {
  stdio: "inherit",
  env: {
    ...process.env,
    AI_PROVIDER: "mock",
    EXERCISE_MEDIA_MODE: "local_private",
    EXERCISE_MEDIA_LOCAL_ROOT: ".local-media/exercises-dataset",
    NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA: "true",
    NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA: "false",
  },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
