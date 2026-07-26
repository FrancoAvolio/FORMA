import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

interface ManifestEntry {
  path: string;
  sha256: string;
  bytes: number;
}

interface DesignManifest {
  files: ManifestEntry[];
}

async function main(): Promise<void> {
  const root = process.cwd();
  const manifestPath = path.join(root, "docs", "DESIGN_REFERENCE_MANIFEST.json");
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as DesignManifest;
  const failures: string[] = [];

  for (const entry of manifest.files) {
    const file = await readFile(path.join(root, entry.path));
    const digest = createHash("sha256").update(file).digest("hex");

    if (file.byteLength !== entry.bytes) {
      failures.push(
        entry.path +
          ": expected " +
          entry.bytes +
          " bytes, found " +
          file.byteLength,
      );
    }

    if (digest.toLowerCase() !== entry.sha256.toLowerCase()) {
      failures.push(entry.path + ": SHA-256 mismatch");
    }
  }

  if (failures.length > 0) {
    throw new Error(
      "Design reference validation failed:\n" + failures.join("\n"),
    );
  }

  console.log(
    "Validated " +
      manifest.files.length +
      " immutable Stitch reference files.",
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
