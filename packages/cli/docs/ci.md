---
title: Running in CI
description: Scaffold a GitHub Actions PR gate with `ci install`, what the generated workflow does, and how to gate a pipeline without the Action.
---

# Running in CI

## Scaffold the GitHub Actions gate

```bash
npx svelte-vitals@latest ci install     # writes .github/workflows/svelte-vitals.yml
npx svelte-vitals@latest ci upgrade     # bump only the pinned action ref in an existing file
```

`ci install` also exists as the `ci-workflow` target inside `svelte-vitals install`, so it can be
set up in the same pass as everything else. Both support `--dry-run` and `--force`.

## What the generated workflow does

On every `pull_request` it checks out with `fetch-depth: 0` (so the base ref is resolvable), then
calls `@svelte-vitals/action`, which runs the analysis **in-process** — no `npx`, no separate
scan per output — scoped to the PR with `diff: origin/<base>` and `baseline: origin/<base>`. From
that one analysis it produces:

- inline annotations on the diff,
- a job summary,
- a sticky PR comment (a hidden `<!-- svelte-vitals-report -->` marker updates the same comment
  instead of piling up new ones).

It fails the job **after** the summary and comment are written, so a failing run still leaves the
feedback behind.

Action inputs: `path` (default `.`), `diff`, `baseline`, `github-token`. There is no `reporter`
input — the fan-out is fixed. The action reads your committed `svelte-vitals.config.*` and
`svelte-vitals-suppressions.json` like the CLI does, so rule policy stays in those files.

Required permissions: `contents: read` and `pull-requests: write`. On PRs from forks GitHub
downgrades the token regardless, so the action detects that and skips the comment (never failing
the job); annotations and the summary still work.

## Without the Action

Any CI can run the CLI directly. `GITHUB_ACTIONS=true` auto-selects the `github` reporter, so
annotations come for free on GitHub:

```bash
pnpm build
npx svelte-vitals@latest --fail-on warning
```

For a PR gate that ignores a legacy backlog, pair the two scoping flags:

```bash
npx svelte-vitals@latest --diff origin/main --baseline origin/main --fail-on warning
```

Gate on the score instead of, or as well as, individual findings with `--min-health <0-100>`.

Exit `1` means findings gated the run; exit `2` means the run did not happen — fail the job
loudly on `2` rather than treating it as a pass.

## Related

- `svelte-vitals docs show scoping` — what `--diff` / `--baseline` / suppressions each do
- `svelte-vitals docs show output` — reporters and exit codes
