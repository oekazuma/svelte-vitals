---
title: CI integration
description: Gate pull requests on svelte-vitals findings with a generated GitHub Actions workflow.
sidebar:
  order: 3
---

`svelte-vitals ci install` scaffolds a GitHub Actions workflow that runs the svelte-vitals installed
in your project on every pull request. One step gives you inline annotations on the diff, a job
summary, and a pass/fail check, with no YAML to hand-write.

## Quick start

```bash
npx svelte-vitals@latest ci install
```

This writes `.github/workflows/svelte-vitals.yml`, with a Node.js setup and an install step for
your package manager (see [The install step](#the-install-step)). Commit it and open a pull request
to see it run.

Setting this up alongside the Vite integration or Cursor rules? `ci-workflow` is also
a selectable target in [`svelte-vitals install`](/guides/install#--client-ids). Pick
it there to write the same workflow file in the same pass, instead of running this command
separately.

```bash
npx svelte-vitals@latest ci install --dry-run   # preview without writing
npx svelte-vitals@latest ci install --force     # regenerate an existing workflow file
```

Re-running `ci install` without `--force` is a no-op if the file already exists, so it is safe to run
again after upgrading svelte-vitals. `--force` replaces an existing file with the current
template, discarding any edits you made to it. When the existing file still calls the retired
GitHub Action, `ci install` says so; see [Migrating from the action](#migrating-from-the-action).

## Adopting on an existing project

With an existing backlog, run `svelte-vitals --update-suppressions` locally first. It writes
`svelte-vitals-suppressions.json` accepting every current finding. Commit it, then turn on any
gate; only findings introduced afterward fail. See
[`--update-suppressions`](/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
for the full behaviour.

The CLI applies the file automatically when present, in CI as on your machine. This workflow is
already scoped to a PR's own changes by `--diff`/`--baseline`; the suppressions file is what lets
you gate **outside** PRs too, such as a local pre-commit hook.

## What the workflow does

On every `pull_request` event, the generated workflow:

1. Checks out the repo with full history (`fetch-depth: 0`) so svelte-vitals can resolve the PR's
   base ref for `--diff`/`--baseline`.
2. Sets up Node.js and installs the project's dependencies with lifecycle scripts off. For some
   setups these lines are left commented out for you to complete; see
   [The install step](#the-install-step).
3. Runs the installed CLI scoped to the PR: `--diff "origin/$BASE_REF"` limits findings to files
   the PR touched, and [`--baseline "origin/$BASE_REF"`](/guides/cli) further narrows to findings
   **newly introduced** by the PR. Pre-existing issues in touched files don't block it. `BASE_REF`
   is set from `github.base_ref` through `env:`, so no `${{ }}` expression is expanded inside the
   shell command.
4. With `--reporter github` under GitHub Actions, that one run writes:
   - Inline annotations on the diff. Their paths are relative to the repository root, so they
     attach to the right file when the app is in a subdirectory.
   - A job summary: the [`md` report](/guides/reporters#md) appended to the job's summary page.
   - Its own warnings, such as a rule that crashed or a config warning, as warning annotations,
     so a passing job shows them too.
5. Fails the step when a finding reaches the project's `failOn` threshold (`critical` unless your
   [config file](/guides/configuration) says otherwise), after the annotations and the summary are
   written. A run that cannot analyze, such as one with an invalid config, fails it with exit `2`.

The workflow posts no PR comment, so it needs no write permission (see [Permissions](#permissions)).

## What the job summary looks like

Before you install anything, here is what the job summary looks like. The finding rows below are
real rule output, assembled here for illustration; the bold lines render as actual headings on the
summary page.

> **svelte-vitals — Health 78/100**
>
> | Category    | Score |
> | ----------- | ----- |
> | seo         | 65    |
> | performance | 90    |
>
> **1 critical · 1 warning · 1 info** (44 checks passed)
>
> **Findings**
>
> | Severity    | Rule                                                                                                        | Location                     | Message                                                                                                                          |
> | ----------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [seo/title-presence](https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence)                     | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [performance/image-dimensions](https://oekazuma.github.io/svelte-vitals/rules/performance/image-dimensions) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [performance/heavy-import](https://oekazuma.github.io/svelte-vitals/rules/performance/heavy-import)         | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

A few things worth knowing before you see the real thing:

- The message column includes the fix. Each row is the finding's message _and_ its
  recommendation together, so you don't have to open the full report to know what to do.
- Rule IDs link to the docs for that specific rule.
- A clean run gets a short summary too: `✅ No issues found.` in place of the findings table.
- The table stops at 50 findings and ends with a count of the rest. Run svelte-vitals locally for
  the full report.

## The install step

`ci install` picks the install step from the lockfile in the directory it runs in. When several
lockfiles are present, `pnpm-lock.yaml` wins, then `yarn.lock`, then Bun's, then
`package-lock.json`.

| Project                                                                                                    | Install step                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                                                                        | `actions/setup-node` with `node-version: 24`, pinned by commit SHA, then `npm ci --ignore-scripts`                                       |
| `pnpm-lock.yaml`, and pnpm 11 or newer in `package.json`'s `packageManager` or `devEngines.packageManager` | `pnpm/setup` with `runtime: node`, pinned by commit SHA, then `pnpm install --frozen-lockfile --ignore-scripts`                          |
| `pnpm-lock.yaml`, with an older pnpm or no pnpm version declared                                           | Commented out: `pnpm install --frozen-lockfile --ignore-scripts`                                                                         |
| `yarn.lock`                                                                                                | Commented out: `yarn install --frozen-lockfile --ignore-scripts` for Yarn 1, `yarn install --immutable --mode=skip-build` for later Yarn |
| `bun.lock` or `bun.lockb`                                                                                  | Commented out: `bun install --frozen-lockfile --ignore-scripts`                                                                          |
| No lockfile                                                                                                | Commented out: `npm ci --ignore-scripts`. Commit your lockfile and re-run `ci install --force` to generate the step                      |

svelte-vitals needs Node.js 24.16.0 or newer, so the workflow sets up Node.js itself rather than
relying on the version the runner image ships. `node-version: 24` sets up a Node.js 24 release.
`pnpm/setup` with `runtime: node` installs the Node.js version `devEngines.runtime` declares, or
the current LTS when there is none.

The pnpm version is read the way the setup action reads it: `devEngines.packageManager`, as a
single object with `name: "pnpm"`, decides when present, otherwise `packageManager`. The array form
of `devEngines.packageManager` is not read.

A commented-out step is one `ci install` cannot write so that it works on the first run: this CLI
pins no setup step for Yarn or Bun, the pinned `pnpm/setup` needs pnpm 11 or newer declared in
`package.json`, and without a lockfile the package manager is unknown. `ci install` (and
`install --client ci-workflow`) then prints a line beginning `! Add an install step` that gives the
reason. In that place, set up Node.js 24.16.0 or newer and your package manager, and uncomment the
install command. Until you do, the svelte-vitals step fails, because there is no
`./node_modules/.bin/svelte-vitals` to run.

The step runs that path rather than `npx svelte-vitals`: in CI, `npx` downloads and runs the latest
published release when none is installed, which is not the version your lockfile pins. Without an
installation the step fails instead. The path needs a `node_modules` directory, so Yarn Plug'n'Play
is not supported; set `nodeLinker: node-modules` in `.yarnrc.yml`.

When the directory has a `package.json` that does not declare `svelte-vitals` and is not a
workspace root (it has no `workspaces` field, and there is no `pnpm-workspace.yaml` beside it),
`ci install` also prints the command that adds it for your package manager, such as
`pnpm add -D svelte-vitals`. At a workspace root it prints a different note; see
[Monorepos](#monorepos).

When `node_modules` holds a `svelte-vitals` older than 0.57.0, `ci install` prints a note naming
that version. An older CLI runs the step, but it writes no job summary, and its annotation paths
are relative to the app rather than the repository root. Update the devDependency.

Lifecycle scripts stay off: the analysis needs none, and they would run dependency code from the
pull request.

The install step fails the job like any other step, before svelte-vitals runs, for example when the
lockfile is out of step with `package.json` or the registry cannot be reached. For a private
registry, give the install step its credentials as an `env:` entry, filled from a repository
secret, that your project's `.npmrc` reads. Lifecycle scripts are off and no other step in the job
installs packages, so the install step is the only one that needs them.

## Monorepos

The workflow file is written at the repository root, and its svelte-vitals step runs there. Which
app the step analyzes depends on how the file was written:

- `svelte-vitals install --client ci-workflow --app apps/web` writes the app's path into the step.
  So does an `install` run that resolves an app for its `vite-plugin`, `vite-hooks` or
  `config-file` targets (see [`--app`](/guides/install#--app-app-in-monorepos)):

  ```yaml
  - run: ./node_modules/.bin/svelte-vitals 'apps/web' --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
  ```

- `ci install`, and an `install` run with no app, write no path, so svelte-vitals picks the app the
  way a local run does: a single SvelteKit app is analyzed automatically, and several make the step
  exit `2` with their list (see [Monorepos](/guides/cli#monorepos)). Add the path after
  `./node_modules/.bin/svelte-vitals` to choose one.

Annotations land on the diff either way, because svelte-vitals writes their paths relative to the
repository root.

The step runs `./node_modules/.bin/svelte-vitals` from the repository root. That works when the
root `package.json` declares `svelte-vitals`, or when the install puts its binary in the root
`node_modules/.bin`. If `./node_modules/.bin/svelte-vitals` exists only in the app's directory, run
the step there: add `working-directory:` and drop the path argument.

```yaml
- run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
  working-directory: apps/web
  env:
    BASE_REF: ${{ github.base_ref }}
```

At a workspace root (a `workspaces` field in `package.json`, or a `pnpm-workspace.yaml`) whose
`package.json` does not declare `svelte-vitals`, `ci install` and `install --client ci-workflow`
print a note saying this.

## Excluding routes or rules

Adopting in CI, most people hit this: SEO rules flag routes that are intentionally not public,
behind auth or in admin areas. Exclusions live in files svelte-vitals reads wherever it runs, so
they apply identically to this workflow, a local run, and the Vite plugin. Pick by intent:

- Never want a rule at all? Turn it off globally in
  [`svelte-vitals.config.*`](/guides/configuration):

  ```js svelte-vitals.config.js
  export default {
    rules: { 'seo/json-ld': 'off' }
  };
  ```

- A rule or category doesn't apply to part of the app, the auth-only case? Scope it with
  [`overrides`](/guides/configuration#scoping-rules-to-routes-or-files-overrides).
  This is durable policy: routes added under the glob later are excluded too.

  ```js svelte-vitals.config.js
  export default {
    // No SEO checks for anything in the (app) route group.
    overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]
  };
  ```

- The findings are real, you just can't fix them all now? Accept the current backlog in one
  shot with `svelte-vitals --update-suppressions` and commit the file; see
  [Adopting on an existing project](#adopting-on-an-existing-project) above. Unlike `overrides`,
  this is a snapshot: a _new_ route with the same problem fails again, which is exactly what you
  want for a backlog.

All three are committed files. The workflow needs no change, and a change to them goes through
review like any other PR.

## Permissions

The generated workflow requests:

```yaml
permissions:
  contents: read
```

Annotations and the job summary come from the step's own output, not from the GitHub API, so read
access is all the workflow needs. Pull requests from forks get the same annotations and summary.
`persist-credentials: false` keeps the checkout token out of the repository's git config, so later
steps cannot use it.

## Writing it by hand

If you'd rather not run the installer, this is exactly what `ci install` generates for an npm
project:

```yaml
# Generated by svelte-vitals (`ci install` or `install --client ci-workflow`).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: 24
      - run: npm ci --ignore-scripts
      - run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
```

For a pnpm project that declares pnpm 11 or newer, it generates:

```yaml
# Generated by svelte-vitals (`ci install` or `install --client ci-workflow`).
# Re-run with --force to regenerate.
name: svelte-vitals

on:
  pull_request:

permissions:
  contents: read

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - uses: pnpm/setup@fa36a5ef7dcdefc3a7cb25655c122e00cf6e636e # v3.1.2
        with:
          install: false
          runtime: node
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - run: ./node_modules/.bin/svelte-vitals --reporter github --diff "origin/$BASE_REF" --baseline "origin/$BASE_REF"
        env:
          BASE_REF: ${{ github.base_ref }}
```

With another package manager, set up Node.js 24.16.0 or newer and the package manager, and install
dependencies with lifecycle scripts off, in the same place: between checkout and the svelte-vitals
step.

Each `uses:` is pinned to a commit SHA, with its version in a comment on the same line. `ci install`
writes the pins bundled into the `svelte-vitals` CLI you run and never queries GitHub, so run it
with `@latest` for the most recent ones. Renovate's github-actions manager reads this form and
proposes updates to it.

See the [CLI reference](/guides/cli) for `--diff`, `--baseline`, and the other flags, and the
[Reporters guide](/guides/reporters) for what the `github` and `md` reporters print.

## Migrating from the action

A workflow that still calls `oekazuma/svelte-vitals-action` keeps running, but the action is
retired. Replace it with the CLI step:

```bash
npx svelte-vitals@latest ci install --force
```

`--force` rewrites the whole file, so carry over any edits you made to it, such as extra triggers
or steps. An app the action's `path` input named becomes the step's path argument or its
`working-directory:` (see [Monorepos](#monorepos)). The new workflow posts no PR comment and does
not request `pull-requests: write`; the job summary carries the report instead. Without `--force`,
`ci install` leaves the file alone and prints a line saying it still calls the retired action.

Until you migrate, upgrading `svelte-vitals` in the project leaves the action's output as it is.
When the action runs the project's CLI, the CLI writes no job summary and no repository-relative
paths of its own, so nothing is doubled, and it prints a line beginning
`svelte-vitals: oekazuma/svelte-vitals-action is retired.` with the command above, which the action
shows as a warning annotation. This lasts until svelte-vitals 1.0.
