---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

New opt-in rule `a11y/unverified-id-ref`: on routes `a11y/no-missing-id-ref` must skip
(composition not fully resolved), it reports id references that match no literal id
anywhere analyzed as unverifiable — never as missing — naming the unresolved component,
spread, `{@html}`, or dynamic id that blocks verification. Off by default: enable it via
`rules: { 'a11y/unverified-id-ref': 'info' }` or `--rules a11y/unverified-id-ref`. Scores
are unchanged for every project that does not enable it. In a nine-app measurement (`docs/superpowers/specs/2026-08-21-unverified-id-ref-precision-measured.md`), 8 of 31 sampled finding sites (49 of 72 findings) were real defects. Source mode only; the vite
plugin prints a notice if it is enabled in rendered mode.
