import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".local-media",
  ".next",
  ".open-next",
  "coverage",
  "node_modules",
  "playwright-report",
  "test-results",
]);

const EXCLUDED_PATH_PREFIXES = [
  "docs/design-reference/",
  "src/data/generated/",
  "src/data/source/",
];

const TEXT_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mjs",
  ".mts",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const TEXT_FILENAMES = new Set([
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "LICENSE",
]);

const MOJIBAKE_PATTERNS = [
  {
    label: "UTF-8 bytes decoded as Latin-1 (two-byte sequence)",
    expression: /(?:\u00c2|\u00c3)[\u0080-\u00bf]/u,
  },
  {
    label: "UTF-8 punctuation decoded as Windows-1252",
    expression:
      /\u00e2[\u00a0-\u00bf\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/u,
  },
  {
    label: "UTF-8 emoji decoded as Windows-1252",
    expression: /\u00f0\u0178/u,
  },
  {
    label: "UTF-8 BOM decoded as visible text",
    expression: /\u00ef\u00bb\u00bf/u,
  },
  {
    label: "Unicode replacement or C1 control character",
    expression: /[\u0080-\u009f\ufffd]/u,
  },
];

const decoder = new TextDecoder("utf-8", { fatal: true });

function toRepositoryPath(absolutePath) {
  return path.relative(ROOT, absolutePath).split(path.sep).join("/");
}

function shouldInspect(relativePath) {
  if (EXCLUDED_PATH_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }

  const filename = path.posix.basename(relativePath);
  return TEXT_FILENAMES.has(filename) || TEXT_EXTENSIONS.has(path.posix.extname(filename));
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectFiles(absolutePath)));
      }
      continue;
    }

    const relativePath = toRepositoryPath(absolutePath);
    if (entry.isFile() && shouldInspect(relativePath)) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

function lineAndColumn(value, offset) {
  const beforeMatch = value.slice(0, offset);
  const lines = beforeMatch.split("\n");
  return { line: lines.length, column: lines.at(-1).length + 1 };
}

const files = await collectFiles(ROOT);
const failures = [];

for (const file of files) {
  const bytes = await readFile(file.absolutePath);
  let value;

  try {
    value = decoder.decode(bytes);
  } catch {
    failures.push(`${file.relativePath}: invalid UTF-8 byte sequence`);
    continue;
  }

  for (const pattern of MOJIBAKE_PATTERNS) {
    const match = pattern.expression.exec(value);
    if (!match) {
      continue;
    }

    const position = lineAndColumn(value, match.index);
    failures.push(
      `${file.relativePath}:${position.line}:${position.column}: ${pattern.label}`,
    );
  }
}

if (failures.length > 0) {
  console.error("UTF-8 validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `UTF-8 validation passed for ${files.length} text files (raw data and immutable design references excluded).`,
  );
}
