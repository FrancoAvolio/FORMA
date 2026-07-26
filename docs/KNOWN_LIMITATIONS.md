# Known limitations and external checks

The following items do not block a complete local product but require external access or human review before a public launch.

- **Gym Visual media licence:** source JPG/GIF binaries remain excluded from production until written permission or a compatible licence is confirmed. Attribution metadata stays visible even when media is disabled.
- **Exercise curation sign-off:** all 156 approved records received an implementation
  source-consistency review and are digest-gated, but difficulty, fatigue, movement,
  prescription, and safety assumptions still require acceptance by a qualified training
  professional. Spanish exercise terminology also requires a native-language review.
- **Cloudflare account verification:** the Workers AI adapter and deployment package can be built and contract-tested locally. A real binding, account quota and chosen production model must be verified in the target Cloudflare account.
- **Ollama availability:** the guided form and deterministic generator work without Ollama. Conversational local interpretation additionally requires Ollama and the configured model on the developer machine.
- **Cloudflare rate-limit scope:** the in-application limiter is per worker isolate and intended
  to stop bursts, not provide a globally consistent user quota. Review target-account controls
  before a high-volume launch without silently enabling a paid product.
- **Browser-local data:** routines do not synchronize between browsers/devices and disappear if
  site storage is cleared. This is an explicit MVP boundary, not an authentication defect.
- **Development audit:** the deployed production dependency audit is clean. The compatible
  ESLint 9/Next plugin toolchain still contains legacy glob-expansion DoS advisories. It handles
  repository-controlled lint paths only; forcing ESLint 10 currently violates plugin peer
  contracts. Track upstream support and re-audit each release.
- **Atomic AI presentation:** structured responses are not streamed into state. FORMA waits for
  complete validation, then renders the result; generation stages prevent a blank loading state.
- **Assistive-technology sign-off:** automated Axe, keyboard semantics, reduced motion, and
  desktop/mobile flows are included, but final screen-reader/zoom testing on the deployed domain
  remains a human release action.
- **No clinical advice:** FORMA rejects unsupported diagnostic, rehabilitation and injury-treatment requests. It is not a substitute for professional medical advice.
