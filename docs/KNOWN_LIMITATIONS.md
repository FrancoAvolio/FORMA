# Known limitations and external checks

The following items do not block a complete local product but require external access or human
review before a public launch. They must not be reported as completed from simulated providers,
automated accessibility checks, repository metadata, or a successful package build alone.

- **Gym Visual media licence:** written permission or a compatible public/commercial licence is
  not confirmed. On 2026-07-29 the repository owner explicitly authorized the pinned source JPG/GIF
  bundle for this limited deployment. Hash/path validation, original watermarks and visible
  attribution remain enforced; this operator decision is not legal clearance.
- **Training-domain sign-off:** all 156 approved records received an implementation
  source-consistency review and are digest-gated, but difficulty, fatigue, movement,
  prescription, substitution, and safety assumptions still require acceptance by a qualified
  training professional.
- **Native-language sign-off:** Spanish-Argentina interface copy, exercise terminology, imported
  instructions, safety wording, and generated/fallback phrasing require review by a native
  Spanish speaker familiar with the training domain.
- **Legal and deployed-domain review:** attribution, privacy, safety disclaimer, third-party
  notices, analytics/cookie behavior if later enabled, and presentation on the final public web
  domain require human legal/privacy review. Repository documentation is not legal advice.
- **Cloudflare release verification:** account onboarding, the real `AI` binding, first deployment,
  live Granite interpretation, deterministic off-topic handling, and one complete browser routine
  smoke test passed on 2026-07-29. The repeated account-backed contract for every interpretation,
  modification, composition, safety, and explanation behavior is not yet recorded. The owner must
  also accept current quota/billing behavior and smoke-test deployed quota exhaustion before a
  high-volume or final public launch; local `npm run test:cloudflare` remains simulated evidence.
- **Ollama model matrix:** the guided form and deterministic generator work without Ollama.
  `qwen3:4b` is the configured local default, but each release must record its real external
  contract result separately from standard validation. If it is not installed, the operator must run
  `ollama pull qwen3:4b`, then in PowerShell run
  `$env:OLLAMA_MODEL='qwen3:4b'; npm run test:ollama` before a 4b result can be claimed.
- **Cloudflare rate-limit scope:** the in-application limiter is per worker isolate and intended
  to stop bursts, not provide a globally consistent user quota. Review target-account controls
  before a high-volume launch without silently enabling a paid product.
- **Browser-local data:** routines do not synchronize between browsers/devices and disappear if
  site storage is cleared. They also do not migrate between hostnames, including the move from
  `forma-routines.fran40v.workers.dev` to `app.forma-gym.workers.dev`. This is an explicit MVP
  boundary, not an authentication defect. The portable PDF provides a visually complete manual
  copy/share path and TXT remains available as a lightweight alternative, but importing either
  file back into FORMA and automatic synchronization remain out of scope.
- **PDF export resources:** the paginated PDF is generated locally on demand and fetches only the
  routine's static thumbnails. Large six-day plans can take several seconds on older phones. A
  failed thumbnail becomes a visible placeholder; GIF animation remains available only through
  the linked exercise page.
- **Development/build audit:** the deployed production dependency audit is clean. The compatible
  ESLint 9/Next plugin toolchain still contains legacy glob-expansion DoS advisories, and the
  OpenNext build-only minifier chain retains high-severity glob/minimatch advisories. These are
  development or packaging paths, not deployed runtime dependencies; forcing major upgrades
  currently violates peer contracts or breaks the Cloudflare build. Track upstream support and
  re-audit each release.
- **Atomic AI presentation:** structured responses are not streamed into state. FORMA waits for
  complete validation, then renders the result; generation stages prevent a blank loading state.
- **Assistive-technology sign-off:** automated Axe, keyboard semantics, reduced motion, and
  desktop/mobile flows are included, but final screen-reader/zoom testing on the deployed domain
  remains a human release action.
- **No clinical advice:** FORMA rejects unsupported diagnostic, rehabilitation and injury-treatment requests. It is not a substitute for professional medical advice.
