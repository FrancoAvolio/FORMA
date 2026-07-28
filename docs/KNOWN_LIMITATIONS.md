# Known limitations and external checks

The following items do not block a complete local product but require external access or human
review before a public launch. They must not be reported as completed from simulated providers,
automated accessibility checks, repository metadata, or a successful package build alone.

- **Gym Visual media licence:** source JPG/GIF binaries remain excluded from production until written permission or a compatible licence is confirmed. Attribution metadata stays visible even when media is disabled.
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
- **Cloudflare account and live-model verification:** the Workers AI adapter and deployment
  package can be built and contract-tested with a simulated binding. The account owner must run
  `npx wrangler login`, complete browser authorization, confirm the real `AI` binding and account
  quota, and exercise the configured production model in the target account before launch. A
  local `npm run test:cloudflare` result does not satisfy this live gate.
- **Ollama model matrix:** the guided form and deterministic generator work without Ollama.
  `qwen3:1.7b` is the configured local default, but each release must record its real external
  contract result separately from standard validation. `qwen3:4b` is not installed on the current
  developer machine and was intentionally not downloaded automatically. The operator must run
  `ollama pull qwen3:4b`, then in PowerShell run
  `$env:OLLAMA_MODEL='qwen3:4b'; npm run test:ollama` before a 4b result can be claimed.
- **Cloudflare rate-limit scope:** the in-application limiter is per worker isolate and intended
  to stop bursts, not provide a globally consistent user quota. Review target-account controls
  before a high-volume launch without silently enabling a paid product.
- **Browser-local data:** routines do not synchronize between browsers/devices and disappear if
  site storage is cleared. This is an explicit MVP boundary, not an authentication defect.
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
