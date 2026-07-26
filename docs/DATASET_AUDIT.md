# Dataset and media audit

This report describes the immutable catalog currently used by FORMA. It is generated from `src/data/generated/dataset-report.json` by `scripts/audit-catalog.mjs`.

## Source pin and integrity

| Field | Value |
| --- | --- |
| Repository | [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) |
| Commit | `7455efae41b330c265e7cd4b78dfa848e7ce5ebd` |
| Commit date | `2026-07-16T09:50:40+03:00` |
| Dataset SHA-256 | `656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d` |
| Total exercises | 1324 |
| Duplicate IDs | None |
| Missing required fields | None |
| Available languages | `en`, `es`, `fr`, `hi`, `it`, `ko`, `pl`, `ru`, `tr`, `zh` |
| Complete Spanish instructions | 1324 |
| Incomplete Spanish instructions | 0 |

The upstream JSON Schema is enforced with Ajv draft 2020-12. Additional validation rejects duplicate IDs and media references, mismatched `id-media_id` filenames, category/body-part mismatches, whitespace-only required strings, missing language maps, traversal paths, absolute paths, remote media paths and malformed timestamps.

## Curation status

| Status | Exercises |
| --- | ---: |
| Approved for deterministic generation | 156 |
| Explicitly excluded | 35 |
| Available in the explorer but unreviewed | 1133 |
| Broken aliases | 0 |
| Broken substitution groups | 0 |
| Implementation-review SHA-256 | `9f1d32edb076e1a56fe68e14e2ab256e2e41bb7d8ca97f586f3b78ec1a3a0c7c` |

Every selected source record received an implementation review against its source name, English instructions, equipment requirements and generated Spanish display name. The review corrected objective mismatches and moved conflicting, duplicate or unsupported records into explicit exclusions. Spanish copy still requires native-language review, and difficulty, movement-pattern, fatigue, skill, rep-range and rest-range mappings remain flagged for qualified fitness-domain review. This does not stop the deterministic engine from enforcing the checked-in contract.

Selection rules prioritize recognizable commercial-gym, barbell, dumbbell, cable, machine, resistance-band, bodyweight and kettlebell movements. The checked-in quotas balance back, chest, shoulders, arms, upper legs, waist and calves; five additional common kettlebell movements prevent a one-exercise equipment dead end. Loaded carries and timed holds whose prescriptions cannot be represented by the current routine schema are explicitly excluded instead of receiving misleading repetition ranges. Gendered variants, novelty combinations, partner/towel variations, plyometrics, handstands, muscle-ups and versioned duplicates remain unreviewed. Source conflicts, unsafe or unsupported prescriptions, near-duplicates and the two loaded-neck records are explicitly excluded with reviewable reasons.

Every approved record carries `programmingAssumptionsRequireDomainReview: true`. The exact generated mapping is reviewable in `src/data/curated/exercise-metadata.json` and the Spanish name map in `src/data/curated/exercise-display-names.es.json`.

Because the upstream record has only one equipment field, curation adds conservative secondary requirements when the source name makes them explicit: benches, pull-up bars, dip bars, stability balls and integrated machines. The routine catalog exposes all of them through `equipment[]`; the original single value remains available as `rawEquipment`. These inferences prevent an exercise from being treated as equipment-free but also require domain review for edge cases.

### Approved movement patterns

| Pattern | Count |
| --- | ---: |
| `core` | 20 |
| `hinge` | 13 |
| `horizontal_pull` | 12 |
| `horizontal_push` | 27 |
| `isolation` | 55 |
| `lunge` | 4 |
| `squat` | 8 |
| `vertical_pull` | 9 |
| `vertical_push` | 8 |

### Approved difficulty assumptions

| Difficulty | Count |
| --- | ---: |
| `advanced` | 2 |
| `beginner` | 104 |
| `intermediate` | 50 |

### Approved required equipment values

| Equipment | Count |
| --- | ---: |
| `band_anchor` | 2 |
| `barbell` | 26 |
| `barbell_rack` | 8 |
| `bench` | 33 |
| `body_weight` | 25 |
| `cable` | 29 |
| `dip_bars` | 1 |
| `dumbbell` | 31 |
| `glute_ham_developer` | 1 |
| `hyperextension_bench` | 1 |
| `kettlebell` | 5 |
| `machine` | 30 |
| `preacher_bench` | 3 |
| `pull_up_bar` | 6 |
| `resistance_band` | 5 |
| `smith_machine` | 1 |
| `stability_ball` | 1 |
| `step_platform` | 2 |
| `weighted` | 3 |

### Explicit exclusions

| Exercise ID | Reason |
| --- | --- |
| `0024` | Source name claims a bench front squat, but its instructions describe a standard front squat. |
| `0026` | Source name claims a bench squat, but its instructions describe a standard rack squat. |
| `0044` | Loaded barbell good mornings require expert programming review before automatic generation. |
| `0068` | Loaded single-leg barbell squat requires advanced balance and expert programming review. |
| `0069` | Overhead squats require advanced mobility, technique and expert programming review. |
| `0071` | Barbell press sit-up combines loaded spinal flexion and pressing beyond the initial safety scope. |
| `0098` | Source name claims a split squat, but its instructions describe a bilateral wide-stance squat. |
| `0099` | Source instructions describe a barbell split squat, not the named single-leg/Bulgarian variant. |
| `2799` | Barbell seated alternating leg raise is obscure and requires explicit safety/programming review. |
| `1372` | Duplicate standing barbell calf-raise variant; the clearer source record remains approved. |
| `3235` | Inverse-curl source label conflicts with instructions for a standard prone cable leg curl. |
| `0861` | Duplicate seated cable-row variant; the clearer reviewed source record remains approved. |
| `0339` | Dumbbell lying femoral record has unclear loading and strength-prescription instructions. |
| `3548` | Loaded carries require distance/time prescriptions that the current routine schema does not support. |
| `0410` | Required elevated supports are alternatives that the current equipment model cannot express. |
| `2803` | Duplicate ordinary dumbbell-squat instructions under a misleading supported-squat label. |
| `2133` | Loaded carries require distance/time prescriptions that the current routine schema does not support. |
| `1511` | Static hamstring stretching is not a loaded routine exercise under the current prescription model. |
| `0489` | Duplicate hyperextension variant; the bench-specific reviewed record remains approved. |
| `0496` | Source instructions describe an unloaded prone leg curl with unclear effective resistance. |
| `2400` | Source label/equipment conflict with instructions for a prone cable leg curl on a bench. |
| `0499` | The required waist-height bar or suspension trainer cannot be represented as equipment alternatives yet. |
| `0533` | Duplicate kettlebell goblet-squat instructions; the clearer goblet-squat record remains approved. |
| `0555` | Low-value kick-out sit variant is not sufficiently clear for automatic strength programming. |
| `1452` | Duplicate seated machine-crunch variant; the chest-pad record remains approved. |
| `1403` | Loaded cervical exercise requires explicit domain and safety review before generation. |
| `0648` | Olympic power cleans require advanced coaching and are outside the initial automatic-generation scope. |
| `1587` | Yoga pose sequence is outside the initial resistance-routine prescription model. |
| `0716` | Loaded cervical exercise requires explicit domain and safety review before generation. |
| `1489` | Sissy squats require explicit knee-tolerance and expert programming review. |
| `0750` | Smith chair-squat source and apparatus details require explicit equipment/programming review. |
| `0765` | Smith-machine source label conflicts with instructions for a handled seated press machine. |
| `0795` | Source instructions describe an unloaded standing leg curl with unclear effective resistance. |
| `2135` | Weighted-plank label conflicts with unweighted timed-hold source instructions. |
| `0835` | Weighted-hyperextension label and unstable-ball prescription require explicit review. |

## Media inventory

| Field | Value |
| --- | ---: |
| Media files | 2648 |
| JPG thumbnails | 1324 |
| GIF animations | 1324 |
| Exercises with thumbnails | 1324 |
| Exercises with animations | 1324 |
| Exercises with missing media | 0 |
| Broken media references | 0 |
| Duplicate media references | 0 |
| Imported bytes | 137,616,454 (131.24 MiB) |
| Media inventory SHA-256 | `924f1a3bba85f165f570975c7e7a89fe536f51246ec9f32d331af217b1dd7958` |
| Public production distribution | Disabled pending license review |

Observed attribution value:

> © Gym visual — https://gymvisual.com/

The binaries exist only under the ignored `.local-media/exercises-dataset/` directory for local development and private evaluation. Import verifies every working-tree file against its Git blob in the pinned commit. `scripts/validate-media.mjs` fails if protected source bytes or filenames appear under `public/`, `.next/`, `.open-next/` or `out/`, even when a binary is renamed with an unrelated extension.

## Source equipment values

| Raw value | Count |
| --- | ---: |
| `assisted` | 15 |
| `band` | 54 |
| `barbell` | 154 |
| `body weight` | 325 |
| `bosu ball` | 3 |
| `cable` | 157 |
| `dumbbell` | 294 |
| `elliptical machine` | 1 |
| `ez barbell` | 23 |
| `hammer` | 1 |
| `kettlebell` | 41 |
| `leverage machine` | 81 |
| `medicine ball` | 13 |
| `olympic barbell` | 2 |
| `resistance band` | 7 |
| `roller` | 8 |
| `rope` | 10 |
| `skierg machine` | 1 |
| `sled machine` | 15 |
| `smith machine` | 48 |
| `stability ball` | 28 |
| `stationary bike` | 1 |
| `stepmill machine` | 1 |
| `tire` | 1 |
| `trap bar` | 1 |
| `upper body ergometer` | 1 |
| `weighted` | 36 |
| `wheel roller` | 2 |

## Source body-part values

| Raw value | Count |
| --- | ---: |
| `back` | 203 |
| `cardio` | 29 |
| `chest` | 163 |
| `lower arms` | 37 |
| `lower legs` | 59 |
| `neck` | 2 |
| `shoulders` | 143 |
| `upper arms` | 292 |
| `upper legs` | 227 |
| `waist` | 169 |

## Source target-muscle values

| Raw value | Count |
| --- | ---: |
| `abductors` | 5 |
| `abs` | 169 |
| `adductors` | 6 |
| `biceps` | 151 |
| `calves` | 59 |
| `cardiovascular system` | 29 |
| `delts` | 143 |
| `forearms` | 37 |
| `glutes` | 144 |
| `hamstrings` | 28 |
| `lats` | 81 |
| `levator scapulae` | 2 |
| `pectorals` | 158 |
| `quads` | 44 |
| `serratus anterior` | 5 |
| `spine` | 19 |
| `traps` | 15 |
| `triceps` | 141 |
| `upper back` | 88 |

## Reproduce this report

After the pinned source has been fetched and local media imported:

```bash
node scripts/validate-dataset.mjs
node scripts/validate-curated.mjs
node scripts/validate-media.mjs --require-local
node scripts/build-catalog.mjs
node scripts/audit-catalog.mjs
node scripts/validate-generated.mjs
```
