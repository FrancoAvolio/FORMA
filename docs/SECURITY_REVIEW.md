# Security review

Review date: 2026-07-25

## Server and AI boundary

- Every AI route reads a bounded request body and validates it with a strict Zod schema.
- User messages, serialized provider requests, provider responses, list sizes, plan sizes, and
  explanations have explicit limits.
- Ollama and Cloudflare calls are server-only, receive a deadline/caller abort signal, and never
  serialize credentials or bindings to Client Components.
- Provider output is parsed as a complete structured value, strictly validated, repaired at
  most once, and rejected without partial state when still invalid.
- Prompts delimit untrusted user/data content; the model cannot execute code, select catalog
  records, decide safety, or validate routines.
- The public interpretation endpoint has a bounded per-client fixed-window burst guard. It is
  intentionally a best-effort per-isolate control; Cloudflare quota/rate errors remain enforced
  and mapped to the deterministic fallback.
- React renders user text as escaped text nodes. There is no HTML injection API, file upload,
  authentication surface, or model-generated code execution.
- All routes receive `nosniff`, clickjacking denial, strict-origin referrer, and restrictive
  camera/microphone/geolocation/browsing-topics headers from the Next.js configuration.

## Catalog and media boundary

- Runtime exercise metadata is bundled from generated, checksum-validated local files; it has
  no network dependency.
- Local protected media requests accept only a manifest-listed kind/basename with strict
  patterns. The reader resolves the target under one configured ignored root and rejects path
  traversal.
- Arbitrary remote replacement URLs are rejected. Licensed replacements must use a fixed local
  public path pattern plus explicit attribution/license metadata.
- Production forces protected local media to the neutral placeholder. Validation scans source
  filenames and hashes in `public`, `.next`, `.open-next`, and `out`.

## Browser data

- Browser persistence is isolated behind a versioned repository and Zod-validates every read
  and write.
- Malformed/unsupported storage returns a clean envelope; migrations are unit-tested.
- The user can delete saved routines, current/draft state, conversation state, and preferences.
- `/privacidad` explains what stays local and what an optional AI provider receives.

## Dependency audit

`npm audit --omit=dev` reports no production dependency vulnerabilities after compatible
overrides for Next's PostCSS/sharp chain and OpenNext's build-only minifier. Both the Next.js
production build and OpenNext build are required after those overrides.

The complete development audit currently reports high-severity denial-of-service advisories in
the ESLint 9 / `eslint-config-next` plugin chain through legacy `minimatch`/`brace-expansion`.
Those packages process repository-controlled lint globs and are absent from the deployed
runtime. ESLint 10 contains the core fix, but the current Next ESLint plugins still declare
peers only through ESLint 9; forcing the major produces an invalid dependency graph. Keep the
latest compatible versions, do not lint attacker-controlled glob patterns, and recheck when the
plugins publish ESLint 10 support.

Commands retained as release evidence:

```bash
npm audit --omit=dev
npm audit
npm run validate
npm run build:cloudflare
npm run validate:media
```

## Residual/manual checks

- For a high-volume public launch, review Cloudflare account-level WAF/rate-limiting controls;
  do not silently enable a paid feature.
- Review provider retention/privacy terms and current quota behavior in the target account.
- Run a deployed security-header/CSP review against the final domain and any analytics added
  later. The MVP intentionally adds no analytics.
- Re-run dependency and secret scans for every release.
