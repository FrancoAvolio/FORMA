# Production readiness

This checklist separates completed repository evidence from account-, legal-, and
professional-review actions that cannot be automated safely.

## Verified in the repository

- [x] Stitch design reference preserved byte-for-byte and checksum validated.
- [x] Dataset source commit pinned; source license and notices preserved.
- [x] Source, generated, curation, aliases, substitutions, and media relationships validated.
- [x] Protected media attribution and separate-license boundary visible in the product.
- [x] Protected source media is restricted to an explicit namespace and checked against pinned
  filenames, sizes and hashes before deployment.
- [x] AI failure, timeout, invalid-output, quota, rate-limit, and guided fallback contracts tested.
- [x] Public AI route input/size validation and best-effort burst limiting enabled.
- [x] Deterministic safety behavior and routine invariants unit/property/integration tested.
- [x] Guided no-AI, Mock chat, editor, persistence, real local media, reduced motion, mobile, and
  disabled-media browser flows automated.
- [x] Privacy behavior and attribution/legal boundaries have dedicated Spanish product pages.
- [x] Production Next.js build and post-build protected-media scan automated by `npm run validate`.
- [x] Cloudflare account onboarding, `workers.dev` publication, real `AI` binding, and a complete
  account-backed chat-to-validated-routine smoke test completed on 2026-07-29.

## Manual launch gates

- [ ] A qualified training professional has accepted the curation digest and programming
  assumptions recorded in `docs/CURATION_REVIEW.md`.
- [ ] A native-Spanish reviewer has accepted exercise names/instructions and safety copy.
- [ ] Gym Visual public/commercial media permission or replacement licensing is confirmed.
- [ ] A legal/privacy reviewer has accepted `/atribuciones`, `/privacidad`, provider terms, and
  the intended jurisdiction/use.
- [x] Cloudflare account and Workers onboarding are complete.
- [ ] The real `AI` binding and configured model pass the repeated account-backed contract.
- [ ] Current Cloudflare Workers/Workers AI usage limits and billing behavior are accepted.
- [ ] The deployed quota-exhaustion fallback is smoke-tested in the target account.
- [ ] Final keyboard/screen-reader/manual responsive review is recorded on target browsers and
  devices.
- [ ] Final deployed URLs, date, commit, dataset digest, curation digest, and validation logs are
  attached to release evidence.

The repository-owner exception uses `wrangler.authorized-media.jsonc` through
`npm run deploy:cloudflare:authorized-media`:

```env
EXERCISE_MEDIA_MODE=owner_authorized_source
NEXT_PUBLIC_ENABLE_EXERCISE_MEDIA=true
NEXT_PUBLIC_AUTOPLAY_EXERCISE_MEDIA=false
```

This exception does not check the public/commercial permission item above. Any deployment that is
not covered by the owner's recorded limited-use decision must return to `disabled` or use reviewed
`licensed_replacements`. The default `wrangler.jsonc` remains `disabled`; a clean Git/Cloudflare
checkout cannot build the authorized bundle because `.local-media` is intentionally ignored.

Until the remaining Cloudflare gates are cleared, the guided form remains the provider-independent
authoritative fallback. Account-backed conversational inference may be described only as the
recorded 2026-07-29 smoke test, not as a completed repeated provider/quota certification.
