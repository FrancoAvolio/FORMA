export const DATASET_SOURCE = Object.freeze({
  repository: "https://github.com/hasaneyldrm/exercises-dataset",
  commit: "7455efae41b330c265e7cd4b78dfa848e7ce5ebd",
  commitDate: "2026-07-16T09:50:40+03:00",
  sourcePaths: Object.freeze({
    dataset: "data/exercises.json",
    schema: "data/exercises.schema.json",
    license: "LICENSE",
    notice: "NOTICE.md",
  }),
  expected: Object.freeze({
    exerciseCount: 1324,
    imageCount: 1324,
    animationCount: 1324,
    mediaBytes: 137616454,
    mediaInventorySha256: "924f1a3bba85f165f570975c7e7a89fe536f51246ec9f32d331af217b1dd7958",
    curationReviewSha256: "9f1d32edb076e1a56fe68e14e2ab256e2e41bb7d8ca97f586f3b78ec1a3a0c7c",
    hashes: Object.freeze({
      datasetSha256: "656634224b8977b99a6d765470ee123260d4979715eaa4e7c0b7c8bb0d79f93d",
      schemaSha256: "33fb14b439c68e12365e14a0759006c40564646ac27084efe1f2e956804b2d49",
      licenseSha256: "99230e0c2e74c54386e31e7282fc4d939ca14942df542b706fcd9fa71c3187fa",
      noticeSha256: "2b078c9ff73670bbcd4503703eb6be624250193b33655948799acc635a11557b",
    }),
  }),
});

export const SOURCE_DIRECTORY = "src/data/source";
export const CURATED_DIRECTORY = "src/data/curated";
export const GENERATED_DIRECTORY = "src/data/generated";
export const LOCAL_MEDIA_DIRECTORY = ".local-media/exercises-dataset";

export const REQUIRED_LANGUAGES = Object.freeze([
  "en",
  "es",
  "fr",
  "hi",
  "it",
  "ko",
  "pl",
  "ru",
  "tr",
  "zh",
]);

export const SOURCE_ATTRIBUTION =
  "hasaneyldrm/exercises-dataset @ 7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
export const MEDIA_ATTRIBUTION = "© Gym visual — https://gymvisual.com/";
