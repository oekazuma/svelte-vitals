---
'@svelte-vitals/core': minor
'svelte-vitals': minor
---

`a11y/no-missing-id-ref` no longer skips silently. The JSON report gains an optional
top-level `skipped` map (rule id → skipped routes, each with its literal id-reference count
and the located causes — unresolved component, spread, `{@html}`, or dynamic id — that
broke the route's closed world), and the CLI prints one warning line with the
skipped/analyzed ratio whenever the rule is selected and at least one analyzed route was
skipped. Scores and findings are unchanged: a skipped route still produces no result.
