---
'@svelte-vitals/core': minor
'svelte-vitals': minor
'@svelte-vitals/vite': minor
---

`--reporter json` gains a top-level `rules` map of rule id to `{ findings, passed }`, listing every rule
that ran.

It answers a question the report could not: `issues` lists only failing findings, so a rule that found
nothing left no trace — indistinguishable from a rule that was never selected. A rule present in `rules`
ran; a rule missing from it was not selected. `passed` is also unavailable elsewhere, since `summary` is
project-wide.

The counts describe the report rather than the tree: baseline, suppression and `--diff` filtering are
applied first, so a rule whose findings were all suppressed shows `findings: 0` and stays present.
