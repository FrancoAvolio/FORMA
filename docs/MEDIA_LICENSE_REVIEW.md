# Gym Visual media license review

Status: **pending — the repository owner authorized a limited source-media deployment on
2026-07-29; this is not a licensing approval**.

## Evidence preserved

- The upstream `LICENSE` explicitly excludes `images/` and `videos/` from the MIT grant.
- The upstream `NOTICE.md` states that the 180×180 media remains © Gym visual and that cloning the repository does not grant downstream reuse rights.
- Both exact pinned documents are preserved under `src/data/source/upstream/`.
- Each source record and generated manifest entry retains its attribution.

## Current enforced project behavior

This is a technical containment policy, not a conclusion that local or private use is
licensed. The launch gate below still requires a legal/licensing determination for the
intended use.

- Import the pinned 180×180 JPG and GIF files into ignored local storage.
- Keep `local_private` development-only and fail closed in production.
- Permit production source files only through the separate
  `owner_authorized_source` mode requested by the repository owner.
- Before packaging, validate all 2,648 filenames, byte sizes and SHA-256 hashes against the pinned
  manifest; reject missing, modified, renamed or out-of-path binaries.
- Stage exactly one copy under `/exercises/source-media/{images,videos}/` and keep the source
  repository, `.git` data and duplicate files out of the artifact.
- Display `© Gym visual — https://gymvisual.com/` whenever a protected asset is shown.
- Permit a resolved 180×180 JPG to appear inside a user-generated personal routine PDF only when
  the `owner_authorized_source` deployment mode is active. Keep the original bytes/watermark,
  show attribution beside the image and repeat the pending-license notice in the PDF.
- Keep the neutral SVG fallback for disabled, missing or unrecognized media.

## Current prohibited project behavior

- Copy protected binaries anywhere except the exact owner-authorized OpenNext static namespace
  or the explicitly authorized in-browser personal PDF representation described above.
- Treat the upstream MIT license as a media license.
- Remove watermarks or attribution.
- Alter, upscale, regenerate, or offer the media as standalone downloads. A routine PDF may
  contain the original thumbnail as contextual exercise material; it must not expose a separate
  media-download action.
- Ship the remote sample images referenced by the Stitch HTML exports.

## Launch gate

- [ ] Review Gym Visual's current terms for the intended public and commercial use.
- [ ] Obtain permission or a suitable license when required.
- [ ] Record the reviewer, date, scope and evidence.
- [ ] Confirm the required visible attribution.
- [ ] Only then enable separately licensed public replacements or establish a reviewed distribution process.

Until every applicable item is resolved, the licensing status remains pending and protected
manifest entries retain `publicProductionUrl: null`. `local_private` remains forced off in
production. The distinct `owner_authorized_source` mode records the owner's deployment decision;
it must not be described as permission from Gym Visual or as public/commercial license clearance.
