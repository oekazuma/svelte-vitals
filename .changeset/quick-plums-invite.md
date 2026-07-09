---
'@svelte-vitals/action': minor
---

First release of `@svelte-vitals/action`, a first-party GitHub Action that runs svelte-vitals in-process during CI: PR annotations, a job summary, and a sticky PR comment, then gates the job on qualifying findings. Inputs: `path` (project directory, default `.`), `diff` (scope findings to files changed vs. a git ref), `baseline` (report only findings not already present at a git ref), and `github-token` (used to read/post/update the sticky PR comment). On pull requests from forks, annotations and the job summary still run, but the sticky comment step is skipped because GitHub Actions downgrades `GITHUB_TOKEN` to read-only in that context.
