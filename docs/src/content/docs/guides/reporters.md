---
title: Reporters
description: Choose how svelte-vitals formats and outputs its findings.
sidebar:
  order: 7
---

svelte-vitals supports seven output reporters. Select one with `--reporter <fmt>`, or let auto-selection pick the right one for your environment.

## Available reporters

### `console` (default)

Human-readable text output, suitable for terminal use. Groups findings by severity and includes route paths and file locations.

```bash
svelte-vitals --reporter console
```

### `json`

Machine-readable JSON output. Useful for scripts, dashboards, or feeding results into other tools.

```bash
svelte-vitals --reporter json
```

### `agent`

A Markdown remediation document designed for AI coding agents. Each failing finding includes:

- The route and source file location
- A concrete code fix with a snippet
- An acceptance check

The `agent` reporter is auto-selected when svelte-vitals detects a known AI-agent environment (e.g. Claude Code sets `CLAUDECODE`). When auto-selected (not explicitly requested), a one-line hint is printed to stderr explaining how to override.

```bash
svelte-vitals --reporter agent
```

Override auto-selection via the environment variable:

```bash
SVELTE_VITALS_REPORTER=agent svelte-vitals
```

### `sarif`

[SARIF v2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) format, compatible with GitHub Code Scanning, Azure DevOps, and other SAST tooling that consumes SARIF.

```bash
svelte-vitals --reporter sarif
```

### `github`

GitHub Actions [workflow command](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions) format. Outputs `::error` and `::warning` annotations that appear inline in pull requests.

The `github` reporter is auto-selected when `GITHUB_ACTIONS=true` is set (which GitHub Actions sets automatically).

```bash
svelte-vitals --reporter github
```

### `md`

A compact Markdown summary — Health score, per-category score table, severity counts, and a
findings table with links to each rule's docs page. Designed for a GitHub Actions job summary or
a PR comment; capped at 50 finding rows to stay within GitHub's comment size limits. See the
[CI integration guide](/svelte-vitals/guides/ci/) for `svelte-vitals ci install`, which wires
this reporter into a generated workflow automatically.

```bash
svelte-vitals --reporter md
```

## HTML report

`--reporter html` writes a self-contained HTML report that you open in a browser. It's the **same UI as the [live dashboard](/svelte-vitals/guides/dev-dashboard/)** — one shared renderer, so the two can't drift apart: the master/detail layout with a searchable, sortable route list, severity/category filters, dark mode, and a copy-to-clipboard [AI Prompt](/svelte-vitals/guides/dev-dashboard/#copy-a-fix-prompt-for-any-finding) on every finding. The only difference is that a static file has no dev server behind it, so the live-update machinery (SSE connection, `measured` refinement as you browse) is absent. The file inlines all its CSS and JS, so it works offline and is easy to attach to a CI run or share.

```bash
svelte-vitals --reporter html                 # writes svelte-vitals-report.html
svelte-vitals --reporter html --out-file report.html
svelte-vitals --reporter html --out-file -     # write to stdout instead of a file
```

By default it writes `svelte-vitals-report.html` in the current directory and prints the path to stderr. Use `--out-file <path>` to change the location, or `--out-file -` to stream it to stdout (for piping or CI artifacts).

## Auto-selection priority

1. **Explicit `--reporter <fmt>`** — always wins.
2. **`SVELTE_VITALS_REPORTER` environment variable** — overrides auto-detection.
3. **AI-agent environment** (e.g. `CLAUDECODE` is set) → `agent`.
4. **GitHub Actions** (`GITHUB_ACTIONS=true`) → `github`.
5. **Default** → `console`.

## Example: CI pipeline

```yaml
# .github/workflows/seo.yml
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on warning
  # GITHUB_ACTIONS is already set; github reporter is auto-selected
```
