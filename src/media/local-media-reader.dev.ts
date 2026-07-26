import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * This module is imported only after the route has rejected production. The
 * root comes from a development-only environment file so production tracing
 * has no repository path from which to collect protected binaries.
 */
export async function readPrivateLocalMedia(
  kind: string,
  filename: string,
): Promise<ArrayBuffer | null> {
  const configuredRoot = process.env.EXERCISE_MEDIA_LOCAL_ROOT;
  if (!configuredRoot) return null;

  const mediaRoot = path.resolve(configuredRoot);
  const target = path.resolve(mediaRoot, kind, filename);
  if (!target.startsWith(mediaRoot + path.sep)) return null;

  try {
    return Uint8Array.from(await readFile(target)).buffer;
  } catch {
    return null;
  }
}
