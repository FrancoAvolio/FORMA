# Exercise curation review

Status: **implementation review complete; qualified fitness and native-Spanish review pending**.

Review date: 2026-07-25  
Pinned dataset: `7455efae41b330c265e7cd4b78dfa848e7ce5ebd`
Implementation-review digest: `9f1d32edb076e1a56fe68e14e2ab256e2e41bb7d8ca97f586f3b78ec1a3a0c7c`

## Scope completed

Every candidate in the initial 171-record selection was compared with its source name,
English instructions, body part, target, equipment and generated Spanish display name.
After corrections, a second pass checked replacement records introduced by the selection
rules. Four additional source-checked bodyweight fundamentals keep the offline guided form
viable with no equipment. The final generation catalog contains 156 common exercises.

The implementation review corrected objective name/instruction conflicts, Spanish typos,
laterality, movement families, substitution families, secondary equipment, Smith-machine
normalization, high-skill prescriptions and duplicate variants. Thirty-five source records
are explicitly excluded with a reason in
`src/data/curated/exercise-exclusions.json`; other source records remain visible in the
explorer as unreviewed.

Loaded carries and timed holds whose prescriptions cannot be represented by the current
routine schema are excluded instead of receiving misleading repetition ranges. Protected
media review is tracked separately in `docs/MEDIA_LICENSE_REVIEW.md`.

## Review boundary

This was a source-consistency and implementation-quality review performed during the build.
It is not medical advice, legal advice, native-language certification or a qualified coach's
programming sign-off. Every approved record retains
`programmingAssumptionsRequireDomainReview: true`.

## Manual launch actions

- A qualified training professional must review the approved movement classifications,
  difficulty, skill, fatigue, rep/rest ranges and safety-sensitive exclusions.
- A native Spanish reviewer must review display names and user-facing exercise copy.
- Record the reviewers, dates and accepted catalog digest in this document or the project's
  release evidence.
- Re-run `npm run data:curate`, `npm run data:build`, `npm run data:audit` and
  `npm run validate` after any accepted correction.

Until those actions are complete, the deterministic engine remains usable with the checked-in
and structurally validated curation, but the product must not claim professional exercise
programming endorsement.
