# @svelte-vitals/action

First-party GitHub Action for [svelte-vitals](https://github.com/oekazuma/svelte-vitals): static SvelteKit code-health checks (SEO, Performance, Correctness, Security, Architecture) on every pull request — inline annotations on the diff, a job summary, and a single sticky PR comment that updates in place on each push.

The easiest way to set it up is the generator (no YAML to hand-write, and it pins a working commit SHA for you):

```bash
npx svelte-vitals@latest ci install
```

Or by hand:

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
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          fetch-depth: 0 # full history, so diff/baseline can resolve the base ref
      - uses: oekazuma/svelte-vitals/packages/action@<sha> # @svelte-vitals/action@<version>
        with:
          diff: origin/${{ github.base_ref }}
          baseline: origin/${{ github.base_ref }}
```

Pin `<sha>`/`<version>` from the latest `@svelte-vitals/action@X.Y.Z` [release tag](https://github.com/oekazuma/svelte-vitals/releases); `npx svelte-vitals ci upgrade` rewrites the pin in an existing workflow.

## Inputs

| Input          | Description                                                          | Default               |
| -------------- | -------------------------------------------------------------------- | --------------------- |
| `path`         | Project directory to analyze                                         | `.`                   |
| `diff`         | Scope findings to files changed vs this git ref (e.g. `origin/main`) | (unset)               |
| `baseline`     | Report only findings not already present at this git ref             | (unset)               |
| `github-token` | Token used to read/post/update the sticky PR comment                 | `${{ github.token }}` |

The job fails when the scan finds gating findings (per the resolved `failOn`, default `critical`) — after the summary/comment are written, so you always get the report. On fork PRs the sticky comment is skipped (GitHub downgrades the token); annotations and the job summary still work.

## Configuration — the inputs are not the whole story

The action runs the **same analysis as the `svelte-vitals` CLI**, so everything you configure in committed files applies here automatically, with no action input involved:

- **[`svelte-vitals.config.*`](https://oekazuma.github.io/svelte-vitals/guides/configuration/)** — disable rules or change their severity (`rules`), scope rules/categories to specific routes or files (`overrides` — e.g. turn SEO rules off for auth-only routes: `overrides: [{ files: 'src/routes/(app)/**', rules: { seo: 'off' } }]`), `failOn`, `weights`, and the rest.
- **[`svelte-vitals-suppressions.json`](https://oekazuma.github.io/svelte-vitals/guides/cli/#svelte-vitals-suppressionsjson----update-suppressions----no-suppressions)** — a committed one-shot acceptance of the existing backlog (`svelte-vitals --update-suppressions`); the action applies it whenever it's present in the repo.

See [Excluding routes or rules](https://oekazuma.github.io/svelte-vitals/guides/ci/#excluding-routes-or-rules) in the CI guide for which mechanism fits which situation, and the [CI integration guide](https://oekazuma.github.io/svelte-vitals/guides/ci/) for the full workflow reference.
