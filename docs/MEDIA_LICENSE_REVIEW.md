# Gym Visual media license review

Status: **pending — public production distribution is disabled**.

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
- Use them for local development and private evaluation.
- Serve them only through a development-only, private local route.
- Display the source attribution whenever a protected asset is shown.
- Fall back to a neutral local SVG in production.

## Current prohibited project behavior

- Copy protected binaries into `public/`, `.next/`, `out/`, `.open-next/` or another public deployment package.
- Treat the upstream MIT license as a media license.
- Remove watermarks or attribution.
- Alter, upscale, regenerate, or offer the media as standalone downloads.
- Ship the remote sample images referenced by the Stitch HTML exports.

## Launch gate

- [ ] Review Gym Visual's current terms for the intended public and commercial use.
- [ ] Obtain permission or a suitable license when required.
- [ ] Record the reviewer, date, scope and evidence.
- [ ] Confirm the required visible attribution.
- [ ] Only then enable separately licensed public replacements or establish a reviewed distribution process.

Until every applicable item is resolved, `local_private` is forced to disabled in production and protected manifest entries have `publicProductionUrl: null`.
