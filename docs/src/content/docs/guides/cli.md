---
title: CLI reference
description: Complete reference for all svelte-vitals command-line flags.
sidebar:
  order: 3
---

## Usage

```bash
svelte-vitals [path] [options]
```

`path` is optional and defaults to the current directory.

> There is also an [`install` subcommand](#svelte-vitals-install) for setting up the MCP server in your AI-agent clients.

Flags below can also be set once in a `svelte-vitals.config` file at the project root instead of being repeated on every invocation — see [Config file](/svelte-vitals/guides/configuration/). A flag always overrides the config file.

## Flags

### `--reporter <fmt>`

Select the output format.

| Value     | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| `console` | Human-readable text output (default)                                   |
| `json`    | Machine-readable JSON                                                  |
| `agent`   | Markdown remediation document for AI coding agents                     |
| `sarif`   | SARIF v2.1 (compatible with GitHub Code Scanning and other SAST tools) |
| `github`  | GitHub Actions annotation format                                       |
| `html`    | Self-contained HTML report, open in a browser                          |

Accepted values: `console, json, agent, sarif, github, or html`

**Auto-selection:** when run inside a known AI-agent environment (e.g. Claude Code sets `CLAUDECODE`), the `agent` reporter is selected automatically. When run inside GitHub Actions (`GITHUB_ACTIONS=true`), the `github` reporter is selected automatically. An explicit `--reporter` flag always overrides auto-selection. You can also override via the `SVELTE_VITALS_REPORTER` environment variable.

### `--json`

Alias for `--reporter=json`.

### `--out-file <path>`

Output path for `--reporter html` (default `svelte-vitals-report.html`; `-` for stdout).

### `--fail-on <severity>`

Exit with code `1` when any finding reaches the given severity threshold.

| Value      | Behavior                             |
| ---------- | ------------------------------------ |
| `critical` | Fail only on critical findings       |
| `warning`  | Fail on warning or critical findings |
| `info`     | Fail on any finding                  |

Default behavior (no `--fail-on`): exit `1` only when critical findings are present.

### `--fail-on-warning`

Alias for `--fail-on=warning`.

### `--min-health <0-100>`

Exit with code `1` when the combined Health score is below the given value. Accepts a number from `0` to `100`.

```bash
svelte-vitals --min-health 80
```

See [Health report](/svelte-vitals/guides/health-report/) for how the score is calculated.

### `--route <glob>`

Only analyze routes whose path matches the given glob pattern.

```bash
svelte-vitals --route "/blog/**"
```

### `--diff [ref]`

Report only findings located in files **changed** versus `ref` (default `HEAD`, i.e. uncommitted changes). Compares against the **merge-base** with `ref`, and includes untracked (new) files — so `--diff main` is "what this branch changed". Great as a PR check.

```bash
svelte-vitals --diff          # uncommitted changes vs HEAD
svelte-vitals --diff main     # everything this branch changed vs main
```

### `--staged`

Report only findings in files **staged** for commit (`git diff --cached`). Ideal as a pre-commit hook to gate just what you're about to commit. Takes precedence over `--diff`.

```bash
svelte-vitals --staged --fail-on warning
```

> Both flags filter findings by their source-file location and assume the project root is the git root. If git is unavailable (or the ref is invalid), svelte-vitals warns and analyzes the whole project.

### `--by-route`

Print a per-route score breakdown in the console output.

### `--rules <ids>`

Enable only the specified rules; all others are disabled. Accepts a comma-separated list of rule IDs.

```bash
svelte-vitals --rules SEO001,SEO002
```

### `--ignore <ids>`

Disable the specified rules. Accepts a comma-separated list of rule IDs.

```bash
svelte-vitals --ignore PERF001
```

### `--weights <pairs>`

Per-category weight overrides for the combined [Health score](/svelte-vitals/guides/health-report/). Accepts comma-separated `category=number` pairs; categories are matched case-insensitively. Unlisted categories default to weight `1`.

```bash
svelte-vitals --weights seo=2,performance=1
```

An unknown category or a negative/non-numeric value is an error (exit `2`).

### Suppressing a single finding inline

For one intentional occurrence that `--ignore` would silence project-wide, add a
`svelte-vitals-disable-next-line` comment on the line directly above it. Works for
any component-scoped rule (Correctness, Security, Architecture, Performance): CORRECT001–004,
SEC001–002, ARCH001–002, PERF009–010.

```svelte
<script>
  // The prerendered HTML always renders this hidden; canVibrate() must run only
  // after mount, or hydration mismatches. $derived would re-run during hydration.
  // svelte-vitals-disable-next-line CORRECT002
  $effect(() => {
    mounted = true;
  });
</script>
```

In markup, use an HTML comment instead:

```html
<!-- svelte-vitals-disable-next-line SEC001 -->
<div>{@html trustedMarkup}</div>
```

Omit the rule id to suppress every rule on the next line, or list several
comma-separated (`CORRECT002, SEC001`).

Two constraints: the comment must be the only thing on its line (a trailing
same-line comment is not recognized), and it must be the line **immediately**
above the target — a blank line in between breaks the match.

### `--meta-components <names>`

Comma-separated list of custom component names that emit `<head>` metadata. Tells the analyzer to treat those components as head-metadata emitters.

```bash
svelte-vitals --meta-components "SeoHead,PageMeta"
```

### `--treat-dynamic-as <mode>`

How to handle routes where a metadata value is set dynamically.

| Value  | Behavior                              |
| ------ | ------------------------------------- |
| `pass` | Dynamic values pass (default)         |
| `warn` | Dynamic values produce a warning      |
| `fail` | Dynamic values are treated as missing |

### `-h, --help`

Print the help text and exit.

### `-v, --version`

Print the version and exit.

## `svelte-vitals install`

Interactively set up the svelte-vitals [MCP server](/svelte-vitals/guides/mcp/) for your AI-agent clients — **Claude Code**, **Cursor**, and **Codex** — by merging the server entry into each client's config (your other servers are left untouched).

```bash
npx svelte-vitals install
```

With no flags it launches an interactive wizard: pick your clients, choose a scope per client, review the plan, and confirm. For non-interactive/CI use, drive it entirely with flags.

### `--client <ids>`

Comma-separated clients/targets to configure: `claude-code`, `cursor`, `codex`, `vite-plugin`, `vite-dev-overlay`. When given, the interactive picker is skipped.

`vite-plugin` registers `@svelte-vitals/vite`'s build-mode plugin in `vite.config.{ts,js,mjs}`; `vite-dev-overlay` wires up the dev-overlay hook in `src/hooks.server.{ts,js}`. Both use a `magicast` codemod that only touches a file whose shape it confidently recognizes — anything else is left alone and a snippet is printed instead. If either is written and `@svelte-vitals/vite` isn't already a dependency, it's installed automatically via the detected package manager. **`--force` does not apply to these two** — an existing registration is always left as-is regardless of the flag.

### `--scope <project|global>`

Where to write the config. Applies to all selected clients; **Codex is always global** (it has no project-scoped config). (Vite targets have no scope and ignore this flag.)

| Client      | project            | global                 |
| ----------- | ------------------ | ---------------------- |
| Claude Code | `.mcp.json`        | `~/.claude.json`       |
| Cursor      | `.cursor/mcp.json` | `~/.cursor/mcp.json`   |
| Codex       | —                  | `~/.codex/config.toml` |

### `--yes`, `-y`

Skip the confirmation prompt.

### `--dry-run`

Print the planned changes and exit without writing anything.

### `--force`

Overwrite an existing `svelte-vitals` entry. By default an entry that already exists is left untouched.

```bash
# Non-interactive: configure Claude Code + Cursor for this project
npx svelte-vitals install --client claude-code,cursor --scope project --yes

# Preview what would change, without writing
npx svelte-vitals install --client codex --dry-run
```

If an existing config can't be parsed, the command fails without writing (exit `2`) rather than overwriting it.

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | No failing findings                                                         |
| `1`  | Critical finding present, or `--fail-on` / `--min-health` threshold reached |
| `2`  | Execution error (not a SvelteKit project / internal error)                  |
