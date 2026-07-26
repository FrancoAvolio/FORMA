# Accessibility and responsive review

Review date: 2026-07-25

## Implemented

- Spanish-Argentina document language, descriptive titles, semantic landmarks, and a skip link.
- Mobile-first layouts, persistent mobile navigation, large controls, visible focus styles, and
  no hover-only essential action.
- Labeled form controls, fieldsets/legends for safety questions, progress semantics, live status
  regions, and explicit alert states.
- Keyboard-operable routine reordering, editing, substitution, saving, and media playback.
- Fixed media dimensions, descriptive demonstration alt text, and an explicit protected-media
  placeholder/caption.
- User-controlled GIF playback. `prefers-reduced-motion: reduce` removes nonessential motion and
  prevents a stored animated preference from auto-restoring on reload; an explicit play action
  remains available.
- Responsive desktop/mobile Playwright projects, including the guided form, Mock chat, routine
  editor, saved-state round trip, explorer/detail, real local media, and mobile navigation.
- Automated Axe checks on stable key pages fail on serious or critical violations.

## Automated evidence

```bash
npm run test:e2e
npm run test:e2e:disabled-media
```

The standard suite runs Chromium at desktop and Pixel 7 viewports. The disabled-media fixture
runs a separate server so the real central-resolver placeholder state is exercised rather than
mocked in the browser.

## Manual launch checks

Automation cannot certify the final deployment on every assistive technology. Before public
launch, record:

- Keyboard-only traversal at 200% zoom with no horizontal overflow.
- NVDA/Firefox or NVDA/Chrome review on Windows.
- VoiceOver/Safari review on iOS/macOS when those platforms are in scope.
- Focus order and announcements after route changes, routine generation, errors, and mutations.
- Text contrast and Spanish pronunciation on the final domain/font rendering.
- Touch review on at least one physical narrow phone and one tablet/desktop viewport.

Any accessibility conflict with the Stitch reference must be resolved in favor of this review
and recorded in `docs/DECISIONS.md`.

