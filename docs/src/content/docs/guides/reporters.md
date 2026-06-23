---
title: Reporters
description: Choose how svelte-vitals formats and outputs its findings.
---

svelte-vitals supports five output reporters. Select one with `--reporter <fmt>`, or let auto-selection pick the right one for your environment.

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
# or use the alias:
svelte-vitals --json
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
  run: npx svelte-vitals --fail-on-warning
  # GITHUB_ACTIONS is already set; github reporter is auto-selected
```
