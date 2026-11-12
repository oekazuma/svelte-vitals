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

On every `pull_request` it checks out with `fetch-depth: 0`, installs dependencies with lifecycle
scripts off, then calls `@svelte-vitals/action` scoped to the PR (`diff`/`baseline` at
`origin/<base>`). It produces:

- inline annotations on the diff,
- a job summary,
- a sticky PR comment (a hidden `<!-- svelte-vitals-report -->` marker updates the same comment
  instead of piling up new ones).

It fails the job **after** writing those, so a failing run still leaves the feedback behind.

The install step is there so the action runs the `svelte-vitals` in your `node_modules` (0.44.0
or newer), the version your lockfile pins. `ci install` writes it for npm (`npm ci
--ignore-scripts`) and for pnpm 11+ (`pnpm/setup`, then `pnpm install --frozen-lockfile
--ignore-scripts`; the pnpm version comes from a single-object `devEngines.packageManager` naming
pnpm, else `packageManager`, and the array form is not read); for anything else it leaves the step commented out and prints why. It also
prints the command to add `svelte-vitals` when `package.json` does not declare it and is not a
workspace root. In a monorepo, declare it in the app's `package.json` and set the action's `path`
input to the app's directory (`path: apps/web`): the action looks for `node_modules/svelte-vitals`
from `path` upward. An installed CLI that cannot produce a report fails the step; there is no fallback.

Without a usable install, the action uses its bundled analyzer and says so in a message
beginning `svelte-vitals: using the bundled svelte-vitals <version>.` To clear it, declare
`svelte-vitals` (0.44.0 or newer) in `package.json` and install dependencies in a step before
the action. `ci upgrade` moves only the pin; it does not add the install step. The action needs
`node_modules/svelte-vitals`, so under Yarn Plug'n'Play set `nodeLinker: node-modules` in
`.yarnrc.yml`.

Inputs: `path` (default `.`), `diff`, `baseline`, `github-token`. No `reporter` input. The
outputs are fixed. Whichever `svelte-vitals` runs reads your committed `svelte-vitals.config.*` and
`svelte-vitals-suppressions.json`, so rule policy stays in those files.

Permissions: `contents: read`, `pull-requests: write`. On fork PRs GitHub downgrades the token
regardless, so the action skips the comment (never failing the job); annotations and summary
still work.

## Without the Action

Any CI can run the CLI directly. On GitHub, `GITHUB_ACTIONS=true` auto-selects the `github`
reporter, so annotations come for free, but a detected AI-agent environment outranks it, so a
job driven by an agent gets `agent` instead. Pass `--reporter github` when you need the
annotations regardless of who is running the job:

```bash
npx svelte-vitals@latest --reporter github --fail-on warning
```

For a PR gate that ignores a legacy backlog, pair the two scoping flags:

```bash
npx svelte-vitals@latest --diff origin/main --baseline origin/main --fail-on warning
```

Gate on the score instead of, or as well as, individual findings with `--min-health <0-100>`.

Exit `1` means findings gated the run; exit `2` means the run did not happen. Fail the job
loudly on `2` rather than treating it as a pass.

## Related

- `svelte-vitals docs show scoping`: what `--diff` / `--baseline` / suppressions each do
- `svelte-vitals docs show output`: reporters and exit codes
