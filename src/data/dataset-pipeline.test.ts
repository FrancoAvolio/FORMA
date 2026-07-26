import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  gitBlobObjectId,
  isSafeGeneratedMediaUrl,
  mediaInventoryDigest,
  normalizeExercise,
  type SourceExerciseRecord,
  validateSourceDataset,
} from "../../scripts/lib/dataset-pipeline.mjs";

const records = JSON.parse(
  await readFile(path.resolve(process.cwd(), "src/data/source/exercises.json"), "utf8"),
) as SourceExerciseRecord[];
const schema = JSON.parse(
  await readFile(path.resolve(process.cwd(), "src/data/source/exercises.schema.json"), "utf8"),
) as unknown;
const validRecord = records[0];

describe("dataset pipeline invariants", () => {
  it("accepts a structurally valid pinned source record", () => {
    expect(validateSourceDataset([structuredClone(validRecord)], schema).totalExercises).toBe(1);
  });

  it("rejects duplicate ids and media references", () => {
    expect(() =>
      validateSourceDataset([structuredClone(validRecord), structuredClone(validRecord)], schema),
    ).toThrow(/duplicate exercise id/u);
  });

  it("rejects traversal and mismatched id-media filenames", () => {
    const unsafe = structuredClone(validRecord);
    unsafe.image = "images/../0001.jpg";
    expect(() => validateSourceDataset([unsafe], schema)).toThrow(/unsafe or unsupported image path/u);
  });

  it("normalizes generated fields without mutating the source record", () => {
    const source = structuredClone(validRecord);
    source.name = `  ${source.name}  `;
    const normalized = normalizeExercise(source);
    expect(normalized.sourceName).toBe(validRecord.name);
    expect(source.name).toContain("  ");
    expect(normalized.equipment).toBeTruthy();
  });

  it("allows only controlled local, placeholder, or replacement media URLs", () => {
    expect(isSafeGeneratedMediaUrl("/api/exercise-media/images/0001-2gPfomN.jpg")).toBe(true);
    expect(isSafeGeneratedMediaUrl("/exercises/placeholders/exercise-media.svg")).toBe(true);
    expect(isSafeGeneratedMediaUrl("https://raw.githubusercontent.com/example.jpg")).toBe(false);
    expect(isSafeGeneratedMediaUrl("/api/exercise-media/images/../secret.jpg")).toBe(false);
  });

  it("detects a same-size dirty file through its pinned Git blob id", () => {
    const pinned = Buffer.from("pinned media bytes");
    const dirty = Buffer.from("changed media byte");
    expect(dirty).toHaveLength(pinned.length);
    expect(gitBlobObjectId(dirty)).not.toBe(gitBlobObjectId(pinned));
  });

  it("pins every media hash through a canonical inventory digest", () => {
    const media = {
      sourcePath: "images/0001-demo.jpg",
      byteSize: 3,
      sha256: "a".repeat(64),
      sourceGitBlob: "b".repeat(40),
      width: 180,
      height: 180,
    };
    const entry = {
      exerciseId: "0001",
      mediaId: "demo",
      thumbnail: media,
      animation: { ...media, sourcePath: "videos/0001-demo.gif" },
    };
    const changed = structuredClone(entry);
    changed.thumbnail.sha256 = "c".repeat(64);
    expect(mediaInventoryDigest([changed])).not.toBe(mediaInventoryDigest([entry]));
  });
});
