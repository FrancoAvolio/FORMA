import { describe, expect, it } from "vitest";

import { createExerciseMediaResolver, EXERCISE_MEDIA_PLACEHOLDER } from "./exercise-media-resolver";

const entry = {
  exerciseId: "0001",
  attribution: "© Gym visual — https://gymvisual.com/",
  canonicalAttribution: "© Gym visual — https://gymvisual.com/",
  protectedMedia: true,
  productionDistribution: "disabled_pending_license_review",
  thumbnail: {
    filename: "0001-2gPfomN.jpg",
    width: 180,
    height: 180,
  },
  animation: {
    filename: "0001-2gPfomN.gif",
    width: 180,
    height: 180,
  },
} as const;

describe("exercise media resolver", () => {
  it("resolves protected files only in local private mode", () => {
    const resolver = createExerciseMediaResolver({
      requestedMode: "local_private",
      runtime: "development",
      manifestEntries: [entry],
    });
    expect(resolver.getMedia("0001")).toMatchObject({ available: true, protectedMedia: true });
  });

  it("forces protected media off in production", () => {
    const resolver = createExerciseMediaResolver({
      requestedMode: "local_private",
      runtime: "production",
      manifestEntries: [entry],
    });
    expect(resolver.getMedia("0001")).toMatchObject({
      available: false,
      thumbnailUrl: EXERCISE_MEDIA_PLACEHOLDER,
      unavailableReason: "production_license_pending",
    });
  });

  it("uses the isolated static namespace for an owner-authorized production bundle", () => {
    const resolver = createExerciseMediaResolver({
      requestedMode: "owner_authorized_source",
      runtime: "production",
      manifestEntries: [entry],
    });

    expect(resolver.getMedia("0001")).toMatchObject({
      available: true,
      thumbnailUrl: "/exercises/source-media/images/0001-2gPfomN.jpg",
      animationUrl: "/exercises/source-media/videos/0001-2gPfomN.gif",
      attribution: entry.attribution,
      protectedMedia: true,
      unavailableReason: null,
    });
  });

  it("returns a stable placeholder for missing optional media", () => {
    const resolver = createExerciseMediaResolver({
      requestedMode: "local_private",
      runtime: "development",
      manifestEntries: [entry],
    });
    expect(resolver.getMedia("9999")).toMatchObject({
      available: false,
      thumbnailUrl: EXERCISE_MEDIA_PLACEHOLDER,
      unavailableReason: "missing_manifest_entry",
    });
  });

  it("accepts only explicit safe licensed replacements", () => {
    const resolver = createExerciseMediaResolver({
      requestedMode: "licensed_replacements",
      runtime: "production",
      manifestEntries: [entry],
      licensedReplacements: {
        "0001": {
          thumbnailUrl: "/exercises/replacements/0001.webp",
          attribution: "Licensed replacement provider",
          licenseReference: "license-record-0001",
        },
      },
    });
    expect(resolver.getMedia("0001")).toMatchObject({ available: true, protectedMedia: false });
  });
});
