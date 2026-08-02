---
title: CI integration
description: Gate pull requests on svelte-vitals findings with a generated GitHub Actions workflow.
sidebar:
  order: 3
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

Setting this up alongside the Vite integration or Agent Skills? `ci-workflow` is also
a selectable target in [`svelte-vitals install`](/guides/install#--client-ids) — pick
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

With an existing backlog, run `svelte-vitals --update-suppressions` locally first: it writes
`svelte-vitals-suppressions.json` accepting every current finding. Commit it, then turn on any
gate — only findings introduced afterward fail. See
[`--update-suppressions`](/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
for the full behaviour.

`@svelte-vitals/action` applies the file automatically when present. This workflow is already
scoped to a PR's own changes by `diff`/`baseline`; the suppressions file is what lets you gate
**outside** PRs too, such as a local pre-commit hook.

## What the workflow does

On every `pull_request` event, the generated workflow:

1. Checks out the repo with full history (`fetch-depth: 0`) so the Action can resolve the PR's
   base ref for `diff`/`baseline`.
2. Calls `@svelte-vitals/action`, which runs svelte-vitals **in-process** (no `npx`, no Node setup
   step, no separate scan per output) scoped to the PR: `diff: origin/<base>` limits findings to
   files the PR touched, and [`baseline: origin/<base>`](/guides/cli) further
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
> | Severity    | Rule                                                                                                        | Location                     | Message                                                                                                                          |
> | ----------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
> | 🔴 critical | [seo/title-presence](https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence)                     | src/routes/blog/+page.svelte | Missing `<title>` Add a `<title>` inside `<svelte:head>`, e.g. `<title>{data.title}</title>`, or set it via your meta component. |
> | 🟡 warning  | [performance/image-dimensions](https://oekazuma.github.io/svelte-vitals/rules/performance/image-dimensions) | src/routes/+page.svelte:12   | Missing `<img>` width/height Set explicit width and height on `<img>` to reserve space and avoid layout shift (CLS).             |
> | 🔵 info     | [performance/heavy-import](https://oekazuma.github.io/svelte-vitals/rules/performance/heavy-import)         | src/routes/+page.svelte:3    | Heavy import "lodash" — 71 KB Import a submodule or switch to a lighter, tree-shakeable alternative.                             |

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

The inputs above are **not** the whole configuration surface: the action runs the same analysis
as the CLI, so it automatically picks up your committed
[`svelte-vitals.config.*`](/guides/configuration) and
[`svelte-vitals-suppressions.json`](/guides/cli#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)
— see the next section.

## Excluding routes or rules

A common wall when adopting in CI: routes that are intentionally not public (behind auth, admin
areas) get flagged by SEO rules, and there's no action input to exclude them — because exclusions
live in files the action already reads, so they apply identically to the CLI, the Vite plugin, and
this action. Pick by intent:

- **Never want a rule at all** — turn it off globally in
  [`svelte-vitals.config.*`](/guides/configuration):

  ```js
  // svelte-vitals.config.mjs
  export default {
    rules: { 'seo/json-ld': 'off' }
  };
  ```

- **A rule or category doesn't apply to part of the app** (the auth-only case) — scope it with
  [`overrides`](/guides/configuration#scoping-rules-to-routes-or-files-overrides).
  This is durable policy: routes added under the glob later are excluded too.

  ```js
  // svelte-vitals.config.mjs
  export default {
    // No SEO checks for anything in the (app) route group.
    overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]
  };
  ```

- **The findings are real, you just can't fix them all now** — accept the current backlog
  one-shot with `svelte-vitals --update-suppressions` and commit the file (see
  [Adopting on an existing project](#adopting-on-an-existing-project) above). Unlike `overrides`,
  this is a snapshot: a _new_ route with the same problem fails again, which is exactly what you
  want for a backlog.

All three are committed files — no workflow inputs involved, and a change to them is reviewed
like any other PR.

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
      - uses: oekazuma/svelte-vitals-action@<sha> # v<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

`ci install` fills in `<sha>`/`<version>` with the pin bundled into the `svelte-vitals` CLI
you're running — a maintainer resolves the latest
[oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) release and
commits it before each `svelte-vitals` release; `ci install` itself never queries GitHub. Running
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
`oekazuma/svelte-vitals/packages/action@<sha>` form are recognized and migrated. Everything else —
other pins, triggers, extra steps — is untouched.

The action repository publishes plain `vX.Y.Z` tags, so Renovate proposes these updates too, with
no extra configuration.

```bash
npx svelte-vitals@latest ci upgrade              # rewrite the pin in place
npx svelte-vitals@latest ci upgrade --dry-run    # preview the before/after without writing
```

The pin `ci upgrade` writes comes from the CLI build itself, not a network lookup — run it with
`@latest` (as above) to pick up the most recent one. Possible outcomes:

- **Upgraded** — the reference line(s) didn't match the bundled pin (either the SHA is stale, or
  the SHA is current but the comment isn't — e.g. it's missing, unrelated, or still in a
  pre-migration shape, `# action-vX.Y.Z` or `# @svelte-vitals/action@X.Y.Z`); they're rewritten
  and the old version (read from the line's comment, in any recognized format, or the old SHA's
  first 7 characters if there was no recognized version comment at all) is reported.
- **Already up to date** — every reference already matches the bundled pin **and** already
  carries the canonical `# vX.Y.Z` comment; nothing is written.
- **No workflow found** / **no action reference found** — exits with an error telling you to run
  `ci install` first; `ci upgrade` never creates a workflow from scratch.

The `vX.Y.Z` tags on [oekazuma/svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action)
are plain semver, so Renovate's built-in github-actions manager already understands them — if you
use Renovate (or another tool) to bump the pin directly, `ci upgrade` won't conflict with it —
both keep the same line in the same `uses: ... @<sha> # v<version>` shape.
