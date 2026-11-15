---
'@svelte-vitals/core': minor
---

`formatGithubReport`, `formatMarkdownReport`, `summarize` and `hasFailureAtOrAbove` are no longer exported from `@svelte-vitals/core`. The GitHub Action that imported them is retired, and the CLI renders and gates in-process. If you still need them, import them from `@svelte-vitals/core/internal`, which carries no semver guarantee and can change in any release.
