---
title: CI integration
description: Gate pull requests on svelte-vitals findings with a generated GitHub Actions workflow.
sidebar:
  order: 9
---

`svelte-vitals ci install` scaffolds a GitHub Actions workflow that calls **`@svelte-vitals/action`**, a
first-party GitHub Action, on every pull request — inline annotations, a job summary, and a single
sticky PR comment, with no YAML to hand-write.

## Quick start

```bash
npx svelte-vitals@latest ci install
```

This writes `.github/workflows/svelte-vitals.yml`. Commit it and open a pull request to see it
run.

Setting this up alongside the MCP server, Vite integration, or Agent Skills? `ci-workflow` is also
a selectable target in [`svelte-vitals install`](/svelte-vitals/guides/install/#--client-ids) — pick
it there to write the same workflow file in the same pass, instead of running this command
separately. `ci upgrade` (below) has no wizard equivalent and stays a standalone command.

```bash
npx svelte-vitals@latest ci install --dry-run   # preview without writing
npx svelte-vitals@latest ci install --force     # regenerate an existing workflow file
```

Re-running `ci install` without `--force` is a no-op if the file already exists (idempotent —
safe to run again after upgrading svelte-vitals). If you already have a workflow from an older
svelte-vitals version, re-run with `--force` to migrate to the current, shorter template.

## Adopting on an existing project

If the repo already has a backlog of findings, run `svelte-vitals --update-suppressions` locally
first: it writes `svelte-vitals-suppressions.json`, accepting every current finding in one shot.
Commit that file, then enable whatever gate you want (`--fail-on`, `--min-health`, a pre-commit
hook, or this workflow) — from then on it only fails on findings introduced afterward, without
having to fix the backlog up front. See [`--update-suppressions`](/svelte-vitals/guides/cli/#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
in the CLI reference for the full behavior. `@svelte-vitals/action` applies this file
automatically too, whenever it's present in the repo — no extra input needed to enable it. Its own
`diff`/`baseline` scoping below already limits _this_ workflow to a PR's own changes; the
suppressions file additionally lets you turn on gating outside of PRs (e.g. `--fail-on` in a local
pre-commit hook) without the same backlog problem.

## What the workflow does

On every `pull_request` event, the generated workflow:

1. Checks out the repo with full history (`fetch-depth: 0`) so the Action can resolve the PR's
   base ref for `diff`/`baseline`.
2. Calls `@svelte-vitals/action`, which runs svelte-vitals **in-process** (no `npx`, no Node setup
   step, no separate scan per output) scoped to the PR: `diff: origin/<base>` limits findings to
   files the PR touched, and [`baseline: origin/<base>`](/svelte-vitals/guides/cli/) further
   narrows to findings **newly introduced** by the PR — pre-existing issues in touched files
   don't block it.
3. From that single analysis, the action produces all three outputs together:
   - Inline annotations on the diff.
   - A job summary.
   - A sticky PR comment — a hidden `<!-- svelte-vitals-report -->` marker lets subsequent pushes
     update the same comment instead of piling up new ones.
4. Fails the job if the scan found any gating findings, after the summary/comment have already
   been written — so you always get the PR comment, even on a failing run.

## What the comment looks like

Before you install anything, here's a preview of the sticky PR comment `@svelte-vitals/action`
posts — this is what a real one renders as (the finding rows below are real rule output, just
assembled here for illustration; the bold lines below render as actual headings in a real GitHub
comment):

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
> | Severity    | Rule                                                              | Location                     | Message                                                                                                                          |
> | ----------- | ----------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [SEO001](https://oekazuma.github.io/svelte-vitals/rules/seo001)   | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [PERF001](https://oekazuma.github.io/svelte-vitals/rules/perf001) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [PERF009](https://oekazuma.github.io/svelte-vitals/rules/perf009) | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

A few things worth knowing before you see the real thing:

- **It updates in place.** Every push to the PR re-scans and edits this same comment (via its
  hidden marker) instead of posting a new one each time.
- **The message column includes the fix.** Each row is the finding's message _and_ its
  recommendation together, so you don't have to open the full report to know what to do.
- **Rule IDs link to the docs** for that specific rule.
- **A clean PR gets a short comment too** — `✅ No issues found.` in place of the findings table.
- The same content (minus the table) also appears in the job's **step summary**, and the
  underlying findings get **inline annotations** directly on the diff.

## Action inputs

`ci install` scaffolds a call to `@svelte-vitals/action` with these inputs:

| Input          | Description                                                          | Default               |
| -------------- | -------------------------------------------------------------------- | --------------------- |
| `path`         | Project directory to analyze                                         | `.`                   |
| `diff`         | Scope findings to files changed vs this git ref (e.g. `origin/main`) | (unset)               |
| `baseline`     | Report only findings not already present at this git ref             | (unset)               |
| `github-token` | Token used to read/post/update the sticky PR comment                 | `${{ github.token }}` |

There's no `reporter` input — the action always produces annotations, the job summary, and the
sticky comment together in one pass; that fan-out isn't something you configure separately.

## Permissions

The generated workflow requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`pull-requests: write` is required to post/update the PR comment. On workflows triggered by pull
requests **from forks**, GitHub Actions downgrades token permissions regardless of what the
workflow declares, so `@svelte-vitals/action` detects fork PRs and skips the sticky comment there
(this can never fail the job) — inline annotations and the job summary still work in that case.

## Writing it by hand

If you'd rather not run the installer, this is exactly what `ci install` generates:

```yaml
# Generated by `svelte-vitals ci install`.
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
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          fetch-depth: 0
      - uses: oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

`ci install` fills in `<sha>`/`<version>` automatically with a real, working commit SHA from this
repository (resolved at `svelte-vitals`'s own build time) — not necessarily the exact commit
`@svelte-vitals/action@<version>`'s release tag points at, but always a commit whose
`packages/action/dist` matches that version. Running the installer is the easiest way to get a
working pin either way. Writing this by hand, use the commit SHA and version from the latest
`@svelte-vitals/action@<version>` release tag in the
[repository](https://github.com/oekazuma/svelte-vitals/releases).

See the [CLI reference](/svelte-vitals/guides/cli/) for `--diff`, `--baseline`, and the equivalent
flags if you'd rather run svelte-vitals directly instead of through the action, and the
[Reporters guide](/svelte-vitals/guides/reporters/) for the output formats the action's summary
and comment build on.

## Upgrading the pinned action

`@svelte-vitals/action` is pinned by commit SHA for supply-chain safety, so the pin in your
workflow goes stale as new releases ship. Regenerating the whole file with `ci install --force`
works, but it throws away any customizations you've made to the workflow (extra triggers, added
steps, etc).

`svelte-vitals ci upgrade` is the surgical alternative: it rewrites **only** the
`uses: oekazuma/svelte-vitals/packages/action@<sha>` line(s) in your existing workflow to the pin
bundled with the CLI you're running — everything else in the file (other `uses:` pins like
`actions/checkout`, your triggers, extra steps) is left untouched.

```bash
npx svelte-vitals@latest ci upgrade              # rewrite the pin in place
npx svelte-vitals@latest ci upgrade --dry-run    # preview the before/after without writing
```

The pin `ci upgrade` writes comes from the CLI build itself, not a network lookup — run it with
`@latest` (as above) to pick up the most recent one. Possible outcomes:

- **Upgraded** — the reference line(s) didn't match the bundled pin; they're rewritten and the
  old version (read from the line's `# @svelte-vitals/action@X.Y.Z` comment) is reported.
- **Already up to date** — every reference already matches the bundled pin; nothing is written.
- **No workflow found** / **no action reference found** — exits with an error telling you to run
  `ci install` first; `ci upgrade` never creates a workflow from scratch.

If you use Renovate (or another tool) to bump the pin directly, `ci upgrade` won't conflict with
it — both keep the same line in the same `uses: ... @<sha> # @svelte-vitals/action@<version>`
shape.
