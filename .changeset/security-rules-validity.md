---
'@svelte-vitals/core': patch
---

Three `security/*` rule content fixes from the v1.0 rule-validity review:

- `security/handler-state-write` and `security/shared-state-import` no longer fire on a universal
  `+page.ts`/`+layout.ts` file that itself exports `ssr = false` — that load never runs on the
  server, so there's no shared-process instance to leak through, and SvelteKit's own docs bless
  this configuration ("If you're not using SSR, then there's no risk of accidentally exposing one
  user's data to another"). The exemption is same-file only: a `+page.server.ts` still runs
  server-side regardless of `ssr` and keeps firing. A false positive removed on the one
  configuration the framework docs call safe.
- `security/handler-state-write`'s message and recommendation now condition the cross-user-leak
  claim instead of asserting it unconditionally — rate limiters and memoization caches keyed by
  non-personal data are the common benign shape for this same call pattern, and the wording now
  says so instead of implying every promoted write is a leak. Severity is unchanged (`critical`).
- `security/handler-state-write` and `security/raw-html` recommendations now mention the inline
  suppression directive, matching their SSR sibling rules (`security/server-module-state`,
  `security/shared-state-import`) which already had it. `raw-html`'s docs also spell out that a
  sanitizer keeps `{@html}` in the source — the finding is expected to persist after sanitizing,
  and suppression (not a further code change) is how a reviewed call clears it.
