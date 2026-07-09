---
'svelte-vitals': minor
---

`svelte-vitals ci install` now scaffolds a short workflow that calls the new `@svelte-vitals/action` GitHub Action instead of generating a ~60-line inline template. The generated workflow no longer includes a `setup-node` step, a duplicate scan pass, or an inline sticky-comment script — the Action owns annotations, the job summary, and the sticky PR comment internally. The Action reference is pinned to a commit SHA with a version comment, matching this repo's own pinning convention. Already-installed workflows are untouched until `ci install --force` is re-run.
