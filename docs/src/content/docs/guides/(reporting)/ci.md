---
title: CI integration
description: Gate pull requests on svelte-vitals findings with a generated GitHub Actions workflow.
sidebar:
  order: 3
---

`svelte-vitals ci install` scaffolds a GitHub Actions workflow that calls `@svelte-vitals/action`, a
first-party GitHub Action, on every pull request. You get inline annotations, a job summary, and a single
sticky PR comment, with no YAML to hand-write.

## Quick start

```bash
npx svelte-vitals@latest ci install
```

This writes `.github/workflows/svelte-vitals.yml`, with an install step for your package manager
(see [The install step](#the-install-step)). Commit it and open a pull request to see it run.

Setting this up alongside the Vite integration or Cursor rules? `ci-workflow` is also
a selectable target in [`svelte-vitals install`](/guides/install#--client-ids). Pick
it there to write the same workflow file in the same pass, instead of running this command
separately. `ci upgrade` (below) has no wizard equivalent and stays a standalone command.

```bash
npx svelte-vitals@latest ci install --dry-run   # preview without writing
npx svelte-vitals@latest ci install --force     # regenerate an existing workflow file
```

Re-running `ci install` without `--force` is a no-op if the file already exists, so it is safe to run
again after upgrading svelte-vitals. `--force` replaces an existing file with the current
template, discarding any edits you made to it.

## Adopting on an existing project

With an existing backlog, run `svelte-vitals --update-suppressions` locally first. It writes
`svelte-vitals-suppressions.json` accepting every current finding. Commit it, then turn on any
gate; only findings introduced afterward fail. See
[`--update-suppressions`](/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
for the full behaviour.

`@svelte-vitals/action` applies the file automatically when present. This workflow is already
scoped to a PR's own changes by `diff`/`baseline`; the suppressions file is what lets you gate
**outside** PRs too, such as a local pre-commit hook.

## What the workflow does

On every `pull_request` event, the generated workflow:

1. Checks out the repo with full history (`fetch-depth: 0`) so the Action can resolve the PR's
   base ref for `diff`/`baseline`.
2. Installs the project's dependencies with lifecycle scripts off, so the action finds the
   `svelte-vitals` your lockfile pins (see [Which svelte-vitals runs](#which-svelte-vitals-runs)).
   For some setups this step is left commented out for you to complete; see
   [The install step](#the-install-step).
3. Calls `@svelte-vitals/action`, which runs svelte-vitals scoped to the PR:
   `diff: origin/<base>` limits findings to files the PR touched, and
   [`baseline: origin/<base>`](/guides/cli) further narrows to findings **newly introduced** by
   the PR. Pre-existing issues in touched files don't block it.
4. The action produces all three outputs:
   - Inline annotations on the diff.
   - A job summary.
   - A sticky PR comment. A hidden `<!-- svelte-vitals-report -->` marker lets subsequent pushes
     update the same comment instead of piling up new ones.
5. Fails the job if the scan found any gating findings, after the summary and comment have already
   been written, so you always get the PR comment, even on a failing run.

## Which svelte-vitals runs

The action looks for `node_modules/svelte-vitals` in the `path` directory and each parent
directory up to the workspace root, and uses the first one it finds.

- **Installed, version 0.44.0 or later.** The action runs that installation's CLI, so CI analyzes
  with the version in your lockfile, and its findings, report and pass/fail match a local
  `svelte-vitals` run. The scan runs twice: once with `--reporter md` for the job summary and the
  PR comment, whose exit code decides whether the step fails, and once with `--reporter github`
  for the annotations. Lines the CLI writes to stderr appear as warning annotations. If only the
  annotation run fails, a warning says so, and the step's result still follows the first run.
- **Installed, but the CLI cannot produce a report.** When it fails to start, exits with an error
  such as an invalid config, or prints nothing, the step fails with the CLI's own error. The
  action does not fall back to its bundled analyzer.
- **No usable installation.** The action analyzes with its bundled analyzer. Before the analysis
  starts, it prints one message beginning `svelte-vitals: using the bundled svelte-vitals <version>.`,
  where `<version>` is the bundled analyzer's version, the same one the report names:

| Situation                                                                         | Level   | To clear it                                                                        |
| --------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| The installed `svelte-vitals` is older than 0.44.0                                | Warning | Update `svelte-vitals` in the project to 0.44.0 or later                           |
| `package.json` at `path` declares `svelte-vitals`, but no installation was found  | Warning | Install dependencies in a step before the action                                   |
| `package.json` at `path` does not declare `svelte-vitals`, and none was installed | Notice  | Add `svelte-vitals` as a devDependency, and install dependencies before the action |

The action needs a `node_modules/svelte-vitals` directory, so under Yarn Plug'n'Play it uses its
bundled analyzer even after an install. Setting `nodeLinker: node-modules` in `.yarnrc.yml` makes
the installed CLI available to it.

## The install step

`ci install` picks the install step from the lockfile in the directory it runs in. When several
lockfiles are present, `pnpm-lock.yaml` wins, then `yarn.lock`, then Bun's, then
`package-lock.json`.

| Project                                                                                                    | Install step                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `package-lock.json`                                                                                        | `npm ci --ignore-scripts`                                                                                                                |
| `pnpm-lock.yaml`, and pnpm 11 or newer in `package.json`'s `packageManager` or `devEngines.packageManager` | `pnpm/setup`, pinned by commit SHA, then `pnpm install --frozen-lockfile --ignore-scripts`                                               |
| `pnpm-lock.yaml`, with an older pnpm or no pnpm version declared                                           | Commented out: `pnpm install --frozen-lockfile --ignore-scripts`                                                                         |
| `yarn.lock`                                                                                                | Commented out: `yarn install --frozen-lockfile --ignore-scripts` for Yarn 1, `yarn install --immutable --mode=skip-build` for later Yarn |
| `bun.lock` or `bun.lockb`                                                                                  | Commented out: `bun install --frozen-lockfile --ignore-scripts`                                                                          |
| No lockfile                                                                                                | Commented out: `npm ci --ignore-scripts`. Commit your lockfile and re-run `ci install --force` to generate the step                      |

The generated `npm ci` step runs on the Node.js and npm that the runner image provides; a project
whose `engines` or `devEngines` reject that version needs its own Node setup step before it.

The pnpm version is read the way the setup action reads it: `devEngines.packageManager`, as a
single object with `name: "pnpm"`, decides when present, otherwise `packageManager`. The array form
of `devEngines.packageManager` is not read.

A commented-out step is one `ci install` cannot write so that it works on the first run: this CLI
pins no setup step for Yarn or Bun, the pinned `pnpm/setup` needs pnpm 11 or newer declared in
`package.json`, and without a lockfile the package manager is unknown. `ci install` (and
`install --client ci-workflow`) then prints a line beginning `! Add an install step` that gives the
reason. Set up your package manager in that
place and uncomment the install command; until you do, the action uses its bundled analyzer.

When the directory has a `package.json` that does not declare `svelte-vitals` and is not a
workspace root (it has no `workspaces` field, and there is no `pnpm-workspace.yaml` beside it),
`ci install` also prints the command that adds it for your package manager, such as
`pnpm add -D svelte-vitals`.

At a workspace root, `ci install` does not print that command. Declare `svelte-vitals` in the app's
own `package.json`, and set the action's `path` input to the app's directory, because the action
analyzes that directory and looks for the installed `svelte-vitals` from there upward:

```yaml
- uses: oekazuma/svelte-vitals-action@<sha> # v<version>
  with:
    path: apps/web
```

Unless `svelte-vitals` is declared and installed where the action looks, CI does not analyze with a
version you chose: the action runs whatever `svelte-vitals` the install happens to
bring in, such as a peer dependency of another package, or else its bundled analyzer.

Lifecycle scripts stay off: the analysis needs none, and they would run dependency code in a job
granted `pull-requests: write`.

The install step fails the job like any other step, before the action runs, for example when the
lockfile is out of step with `package.json` or the registry cannot be reached. For a private
registry, give the install step its credentials as an `env:` entry, filled from a repository
secret, that your project's `.npmrc` reads. Lifecycle scripts are off and no other step in the job
installs packages, so the install step is the only one that needs them.

If your workflow has no install step before the action step, the action analyzes with its bundled
analyzer and prints the message above. Add the step between checkout and the action, as in
[Writing it by hand](#writing-it-by-hand), or regenerate the file with `ci install --force`, which
discards your edits to it. `ci upgrade` changes only the action pin and does not add the step.

## What the comment looks like

Before you install anything, here is what the sticky PR comment `@svelte-vitals/action` posts looks
like. The finding rows below are real rule output, assembled here for illustration; the bold lines
render as actual headings in a real GitHub comment.

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

- It updates in place. Every push to the PR re-scans and edits this same comment (via its
  hidden marker) instead of posting a new one each time.
- The message column includes the fix. Each row is the finding's message _and_ its
  recommendation together, so you don't have to open the full report to know what to do.
- Rule IDs link to the docs for that specific rule.
- A clean PR gets a short comment too: `✅ No issues found.` in place of the findings table.
- The same content, minus the table, also appears in the job's step summary, and the
  underlying findings get inline annotations directly on the diff.

## Action inputs

`ci install` scaffolds a call to `@svelte-vitals/action` with these inputs:

| Input          | Description                                                          | Default               |
| -------------- | -------------------------------------------------------------------- | --------------------- |
| `path`         | Project directory to analyze                                         | `.`                   |
| `diff`         | Scope findings to files changed vs this git ref (e.g. `origin/main`) | (unset)               |
| `baseline`     | Report only findings not already present at this git ref             | (unset)               |
| `github-token` | Token used to read/post/update the sticky PR comment                 | `${{ github.token }}` |

There's no `reporter` input. The action always produces annotations, the job summary, and the
sticky comment together; that combination isn't something you configure separately.

The inputs above are **not** the whole configuration. Whichever `svelte-vitals` runs, installed
or bundled, reads your project the way a local CLI run does, so it automatically picks up your
committed
[`svelte-vitals.config.*`](/guides/configuration) and
[`svelte-vitals-suppressions.json`](/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions).
See the next section.

## Excluding routes or rules

Adopting in CI, most people hit this: SEO rules flag routes that are intentionally not public,
behind auth or in admin areas, and there is no action input to exclude them. That is because
exclusions live in files the action already reads, so they apply identically to the CLI, the Vite
plugin, and this action. Pick by intent:

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

All three are committed files. No workflow inputs are involved, and a change to them goes through
review like any other PR.

## Permissions

The generated workflow requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`pull-requests: write` is required to post/update the PR comment. On workflows triggered by pull
requests **from forks**, GitHub Actions downgrades token permissions regardless of what the
workflow declares, so `@svelte-vitals/action` detects fork PRs and skips the sticky comment there,
which can never fail the job. Inline annotations and the job summary still work in that case.

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
  pull-requests: write

jobs:
  svelte-vitals:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false
      - run: npm ci --ignore-scripts
      - uses: oekazuma/svelte-vitals-action@<sha> # v<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
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
  pull-requests: write

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
      - run: pnpm install --frozen-lockfile --ignore-scripts
      - uses: oekazuma/svelte-vitals-action@<sha> # v<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

With another package manager, set it up and install dependencies with lifecycle scripts off in the
same place, between checkout and the action.

`ci install` fills in `<sha>`/`<version>` with the pin bundled into the `svelte-vitals` CLI
you're running, resolved from the latest
[oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) release as of
each `svelte-vitals` release. `ci install` itself never queries GitHub. Running
the installer (with `@latest`, to get the most recently bundled pin) is the easiest way to get a
working pin. Writing this by hand, use the commit SHA and version from the latest release tag in
that [repository](https://github.com/oekazuma/svelte-vitals-action/releases).

See the [CLI reference](/guides/cli) for `--diff`, `--baseline`, and the equivalent
flags if you'd rather run svelte-vitals directly instead of through the action, and the
[Reporters guide](/guides/reporters) for the output formats the action's summary
and comment build on.

## Upgrading the pinned action

`@svelte-vitals/action` is pinned by commit SHA for supply-chain safety, so the pin in your
workflow goes stale as new releases ship. Regenerating the whole file with `ci install --force`
works, but it throws away any customizations you've made to the workflow (extra triggers, added
steps, etc).

`svelte-vitals ci upgrade` is the surgical alternative: it rewrites **only** the action `uses:`
line(s) to the pin bundled with the CLI you're running. Both the current
`oekazuma/svelte-vitals-action@<sha>` form and the pre-migration
`oekazuma/svelte-vitals/packages/action@<sha>` form are recognized and migrated. Everything else stays
untouched: other pins, triggers, extra steps.

The action repository publishes plain `vX.Y.Z` tags, so Renovate proposes these updates too, with
no extra configuration.

```bash
npx svelte-vitals@latest ci upgrade              # rewrite the pin in place
npx svelte-vitals@latest ci upgrade --dry-run    # preview the before/after without writing
```

The pin `ci upgrade` writes comes from the CLI build itself, not a network lookup. Run it with
`@latest`, as above, to pick up the most recent one. Possible outcomes:

- Upgraded. The reference lines didn't match the bundled pin, either because the SHA is stale,
  or because the SHA is current but the comment isn't (missing, unrelated, or still in a
  pre-migration shape such as `# action-vX.Y.Z` or `# @svelte-vitals/action@X.Y.Z`). svelte-vitals
  rewrites them and reports the old version, read from the line's comment in any recognized
  format, or the old SHA's first 7 characters when there was no recognized version comment at all.
- Already on the bundled pin. Every reference already matches the bundled pin **and** already
  carries the canonical `# vX.Y.Z` comment; nothing is written. This compares against the pin
  this CLI bundles, so a newer action release can exist: it reaches `ci upgrade` with a later
  `svelte-vitals` release.
- No workflow found, or no action reference found. `ci upgrade` exits `2` with an error; when the
  workflow is missing, the error tells you to run `ci install` first. It never creates a workflow from scratch.

The `vX.Y.Z` tags on [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action)
are plain semver, so Renovate's built-in github-actions manager already understands them. If you
use Renovate, or another tool, to bump the pin directly, `ci upgrade` won't conflict with it:
both keep the same line in the same `uses: ... @<sha> # v<version>` shape.
