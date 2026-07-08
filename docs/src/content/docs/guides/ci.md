---
title: CI integration
description: Gate pull requests on svelte-vitals findings with a generated GitHub Actions workflow.
sidebar:
  order: 9
---

`svelte-vitals ci install` scaffolds a GitHub Actions workflow that scans every pull request,
posts inline annotations, writes a job summary, and keeps a single sticky PR comment updated
with the results — no YAML to hand-write.

## Quick start

```bash
npx svelte-vitals ci install
```

This writes `.github/workflows/svelte-vitals.yml`. Commit it and open a pull request to see it
run.

```bash
npx svelte-vitals ci install --dry-run   # preview without writing
npx svelte-vitals ci install --force     # regenerate an existing workflow file
```

Re-running `ci install` without `--force` is a no-op if the file already exists (idempotent —
safe to run again after upgrading svelte-vitals).

## What the workflow does

On every `pull_request` event, the job:

1. Checks out the repo with full history (`fetch-depth: 0`) so `--diff`/`--baseline` can resolve
   the PR's base ref.
2. Runs svelte-vitals scoped to the PR: `--diff origin/<base>` limits findings to files the PR
   touched, and [`--baseline origin/<base>`](/svelte-vitals/guides/cli/) further narrows to
   findings **newly introduced** by the PR — pre-existing issues in touched files don't block it.
3. Emits `--reporter github` output, which GitHub renders as inline annotations on the diff.
4. Emits `--reporter md` output into the job summary and a pull request comment. The comment is
   sticky: a hidden `<!-- svelte-vitals-report -->` marker lets subsequent pushes update the same
   comment instead of piling up new ones.
5. Fails the job (`exit 1`) if the scan step found any gating findings, after the summary/comment
   steps have already run — so you always get the PR comment, even on a failing run.

## Permissions

The generated workflow requests:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`pull-requests: write` is required to post/update the PR comment. On workflows triggered by pull
requests **from forks**, GitHub Actions downgrades token permissions regardless of what the
workflow declares, so the generated workflow skips the comment step on fork PRs (and the step is
marked `continue-on-error`, so it can never fail the job) — the inline annotations and job summary
still work in that case.

## Writing it by hand

If you'd rather not run the installer, here is a minimal gate (not the full generated workflow —
one scan, no Markdown summary, no sticky PR comment, no separate gate step):

```yaml
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
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx svelte-vitals . --diff origin/${{ github.base_ref }} --baseline origin/${{ github.base_ref }} --fail-on-warning
```

Under GitHub Actions the `github` reporter is auto-selected, so this still produces inline
annotations; run `svelte-vitals ci install` if you want the full job summary + sticky comment flow.

See the [Reporters guide](/svelte-vitals/guides/reporters/) for the full list of output formats
and the [CLI reference](/svelte-vitals/guides/cli/) for `--diff`, `--baseline`, and `--fail-on`.
