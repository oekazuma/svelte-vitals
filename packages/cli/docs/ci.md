---
title: Running in CI
description: Scaffold a GitHub Actions PR gate with `ci install`, what the generated workflow does, and how to gate any other pipeline.
---

# Running in CI

## Scaffold the GitHub Actions gate

```bash
npx svelte-vitals@latest ci install     # writes .github/workflows/svelte-vitals.yml
```

`ci install` also exists as the `ci-workflow` target inside `svelte-vitals install`, so it can be
set up in the same pass as everything else. Both support `--dry-run` and `--force`.

## What the generated workflow does

On every `pull_request` it checks out with `fetch-depth: 0`, sets up Node.js, installs
dependencies with lifecycle scripts off, then runs the installed CLI scoped to the PR:

```bash
./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
```

Under GitHub Actions that one run writes:

- inline annotations on the diff, with paths relative to the repository root,
- a job summary (the `md` report),
- its own warnings (a crashed rule, a config warning) as `::warning` annotations.

It fails the step **after** writing those when a finding reaches `failOn` (default `critical`).
There is no PR comment, and the only permission is `contents: read`.

`ci install` writes the setup and install for npm (`actions/setup-node`, then `npm ci
--ignore-scripts`) and for pnpm 11+ (`pnpm/setup` with `runtime: node`, then `pnpm install
--frozen-lockfile --ignore-scripts`; the pnpm version comes from a single-object
`devEngines.packageManager` naming pnpm, else `packageManager`, and the array form is not read).
For anything else it writes the install commented out, with a comment telling you to set up
Node.js 24.16.0 or newer and your package manager first, and prints why.

The step runs `./node_modules/.bin/svelte-vitals`, never `npx`, so without an install it fails
instead of downloading a CLI. Under Yarn Plug'n'Play set `nodeLinker: node-modules` in
`.yarnrc.yml`. When it writes the workflow, `ci install` also prints the command to add
`svelte-vitals` if `package.json` does not declare it and is not a workspace root, and a note if
`node_modules` holds a version older than 0.57.0, which writes no summary and no
repository-relative paths.

In a monorepo the step runs at the repository root. `install --client ci-workflow --app apps/web`
puts the app's path in the step; without one, svelte-vitals picks the app as a local run does
(`svelte-vitals docs show monorepo`). If `./node_modules/.bin/svelte-vitals` exists only in the
app's directory, add `working-directory: apps/web` to the step and drop the path.

Whichever way it runs, svelte-vitals reads your committed `svelte-vitals.config.*` and
`svelte-vitals-suppressions.json`, so rule policy stays in those files.

A workflow that still calls the retired GitHub Action: run `ci install --force` to replace it
(this discards your edits to the file). Until then, a newer CLI leaves the action's output as it is
and prints a line saying the action is retired.

## Other pipelines

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
