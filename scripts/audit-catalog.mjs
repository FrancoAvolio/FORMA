#!/usr/bin/env node

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");
const report = JSON.parse(
  await readFile(path.join(projectRoot, "src/data/generated/dataset-report.json"), "utf8"),
);

function inventoryTable(values) {
  return Object.entries(values)
    .map(([value, count]) => `| \`${value}\` | ${count} |`)
    .join("\n");
}

function result(value) {
  return Array.isArray(value) && value.length === 0 ? "None" : String(value);
}

const markdown = `# Dataset and media audit

This report describes the immutable catalog currently used by FORMA. It is generated from \`src/data/generated/dataset-report.json\` by \`scripts/audit-catalog.mjs\`.

## Source pin and integrity

| Field | Value |
| --- | --- |
| Repository | [hasaneyldrm/exercises-dataset](${report.dataset.repository}) |
| Commit | \`${report.dataset.commit}\` |
| Commit date | \`${report.dataset.commitDate}\` |
| Dataset SHA-256 | \`${report.dataset.datasetSha256}\` |
| Total exercises | ${report.dataset.totalExercises} |
| Duplicate IDs | ${result(report.dataset.duplicateIds)} |
| Missing required fields | ${result(report.dataset.missingRequiredFields)} |
| Available languages | ${report.dataset.availableLanguages.map((language) => `\`${language}\``).join(", ")} |
| Complete Spanish instructions | ${report.dataset.exercisesWithSpanishInstructions} |
| Incomplete Spanish instructions | ${report.dataset.exercisesWithoutCompleteSpanishInstructions.length} |

The upstream JSON Schema is enforced with Ajv draft 2020-12. Additional validation rejects duplicate IDs and media references, mismatched \`id-media_id\` filenames, category/body-part mismatches, whitespace-only required strings, missing language maps, traversal paths, absolute paths, remote media paths and malformed timestamps.

## Curation status

| Status | Exercises |
| --- | ---: |
| Approved for deterministic generation | ${report.curation.approvedExercises} |
| Explicitly excluded | ${report.curation.excludedExercises} |
| Available in the explorer but unreviewed | ${report.curation.unreviewedExercises} |
| Broken aliases | ${report.curation.brokenAliases.length} |
| Broken substitution groups | ${report.curation.brokenSubstitutionGroups.length} |
| Implementation-review SHA-256 | \`${report.curation.implementationReviewSha256}\` |

Every selected source record received an implementation review against its source name, English instructions, equipment requirements and generated Spanish display name. The review corrected objective mismatches and moved conflicting, duplicate or unsupported records into explicit exclusions. Spanish copy still requires native-language review, and difficulty, movement-pattern, fatigue, skill, rep-range and rest-range mappings remain flagged for qualified fitness-domain review. This does not stop the deterministic engine from enforcing the checked-in contract.

Selection rules prioritize recognizable commercial-gym, barbell, dumbbell, cable, machine, resistance-band, bodyweight and kettlebell movements. The checked-in quotas balance back, chest, shoulders, arms, upper legs, waist and calves; five additional common kettlebell movements prevent a one-exercise equipment dead end. Loaded carries and timed holds whose prescriptions cannot be represented by the current routine schema are explicitly excluded instead of receiving misleading repetition ranges. Gendered variants, novelty combinations, partner/towel variations, plyometrics, handstands, muscle-ups and versioned duplicates remain unreviewed. Source conflicts, unsafe or unsupported prescriptions, near-duplicates and the two loaded-neck records are explicitly excluded with reviewable reasons.

Every approved record carries \`programmingAssumptionsRequireDomainReview: true\`. The exact generated mapping is reviewable in \`src/data/curated/exercise-metadata.json\` and the Spanish name map in \`src/data/curated/exercise-display-names.es.json\`.

Because the upstream record has only one equipment field, curation adds conservative secondary requirements when the source name makes them explicit: benches, pull-up bars, dip bars, stability balls and integrated machines. The routine catalog exposes all of them through \`equipment[]\`; the original single value remains available as \`rawEquipment\`. These inferences prevent an exercise from being treated as equipment-free but also require domain review for edge cases.

### Approved movement patterns

| Pattern | Count |
| --- | ---: |
${inventoryTable(report.curation.approvedByMovementPattern)}

### Approved difficulty assumptions

| Difficulty | Count |
| --- | ---: |
${inventoryTable(report.curation.approvedByDifficulty)}

### Approved required equipment values

| Equipment | Count |
| --- | ---: |
${inventoryTable(report.curation.approvedByCanonicalEquipment)}

### Explicit exclusions

| Exercise ID | Reason |
| --- | --- |
${report.curation.explicitExclusions
  .map((exclusion) => `| \`${exclusion.exerciseId}\` | ${exclusion.reason} |`)
  .join("\n")}

## Media inventory

| Field | Value |
| --- | ---: |
| Media files | ${report.media.totalFiles} |
| JPG thumbnails | ${report.media.thumbnailFiles} |
| GIF animations | ${report.media.animationFiles} |
| Exercises with thumbnails | ${report.media.exercisesWithThumbnails} |
| Exercises with animations | ${report.media.exercisesWithAnimations} |
| Exercises with missing media | ${report.media.exercisesWithMissingMedia} |
| Broken media references | ${report.media.brokenMediaReferences.length} |
| Duplicate media references | ${report.media.duplicateMediaReferences.length} |
| Imported bytes | ${report.media.importedBytes.toLocaleString("en-US")} (${(
  report.media.importedBytes /
  1024 /
  1024
).toFixed(2)} MiB) |
| Media inventory SHA-256 | \`${report.media.inventorySha256}\` |
| Public production distribution | Disabled pending license review |

Observed attribution value:

> ${report.media.attributionValues.join("; ")}

The binaries exist only under the ignored \`.local-media/exercises-dataset/\` directory for local development and private evaluation. Import verifies every working-tree file against its Git blob in the pinned commit. \`scripts/validate-media.mjs\` fails if protected source bytes or filenames appear under \`public/\`, \`.next/\`, \`.open-next/\` or \`out/\`, even when a binary is renamed with an unrelated extension.

## Source equipment values

| Raw value | Count |
| --- | ---: |
${inventoryTable(report.dataset.equipmentValues)}

## Source body-part values

| Raw value | Count |
| --- | ---: |
${inventoryTable(report.dataset.bodyPartValues)}

## Source target-muscle values

| Raw value | Count |
| --- | ---: |
${inventoryTable(report.dataset.targetValues)}

## Reproduce this report

After the pinned source has been fetched and local media imported:

\`\`\`bash
node scripts/validate-dataset.mjs
node scripts/validate-curated.mjs
node scripts/validate-media.mjs --require-local
node scripts/build-catalog.mjs
node scripts/audit-catalog.mjs
node scripts/validate-generated.mjs
\`\`\`
`;

const targetPath = path.join(projectRoot, "docs/DATASET_AUDIT.md");
if (checkOnly) {
  let current;
  try {
    current = await readFile(targetPath, "utf8");
  } catch {
    throw new Error("Generated dataset audit is missing. Run node scripts/audit-catalog.mjs.");
  }
  if (current !== markdown) {
    throw new Error("Generated dataset audit is stale. Run node scripts/audit-catalog.mjs.");
  }
  console.log("Validated docs/DATASET_AUDIT.md freshness.");
  process.exit(0);
}
await mkdir(path.dirname(targetPath), { recursive: true });
const temporaryPath = `${targetPath}.tmp`;
await writeFile(temporaryPath, markdown);
await rm(targetPath, { force: true });
await rename(temporaryPath, targetPath);
console.log("Wrote docs/DATASET_AUDIT.md.");
