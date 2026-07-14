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

> There is also an [`install` subcommand](/svelte-vitals/guides/install/) for setting up the MCP server, [Agent Skills](/svelte-vitals/guides/agent-skills/), and the Vite integration in your AI-agent clients, and a `ci install` subcommand that scaffolds a GitHub Actions PR gate — see [CI integration](/svelte-vitals/guides/ci/).

Flags below can also be set once in a `svelte-vitals.config` file at the project root instead of being repeated on every invocation — see [Config file](/svelte-vitals/guides/configuration/). A flag always overrides the config file.

## Monorepos

Passing an explicit `path` (or running inside the app directory itself) always takes priority — svelte-vitals never second-guesses a target you named.

When no `path` is given and the current directory isn't a SvelteKit app, svelte-vitals looks for SvelteKit apps nearby (directories with `svelte.config.{js,ts}` and `src/routes`) instead of failing immediately:

- **Exactly one app found:** it's analyzed automatically, with a notice on stderr (`detected SvelteKit app at apps/web; analyzing it.`).
- **Multiple apps found, interactive terminal:** you get a single-select prompt to choose which one to analyze. Cancelling exits `0` without analyzing anything.
- **Multiple apps found, non-interactive (CI, agents, piped output):** svelte-vitals never prompts — it exits `2` with the list of detected apps and a hint to pass one explicitly, e.g. `npx svelte-vitals@latest apps/web`.
- **No apps found:** the original "not a SvelteKit project" error, exit `2`.

```bash
cd my-monorepo
npx svelte-vitals@latest              # detects apps/web + apps/admin, prompts to pick one (or auto-picks if there's only one)
npx svelte-vitals@latest apps/web     # skips detection entirely — analyzes apps/web directly
```

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
| `md`      | Compact Markdown summary for PR comments / job summaries               |

Accepted values: `console, json, agent, sarif, github, html, or md`

**Auto-selection:** when run inside a known AI-agent environment (e.g. Claude Code sets `CLAUDECODE`), the `agent` reporter is selected automatically. When run inside GitHub Actions (`GITHUB_ACTIONS=true`), the `github` reporter is selected automatically. An explicit `--reporter` flag always overrides auto-selection. You can also override via the `SVELTE_VITALS_REPORTER` environment variable.

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

### `--min-health <0-100>`

Exit with code `1` when the combined Health score is below the given value. Accepts a number from `0` to `100`.

```bash
svelte-vitals --min-health 80
```

See [Health report](/svelte-vitals/guides/health-report/) for how the score is calculated.

### `--score`

Print only the combined Health score (an integer) to stdout, suppressing all other reporter output. Useful in shell prompts or scripts that just want the number without parsing JSON.

```bash
svelte-vitals --score
svelte-vitals --score --min-health 80   # gate on the score; exit code still reflects pass/fail
```

Combining `--score` with `--reporter` is not an error, but the reporter output is suppressed and a warning is printed to stderr. The exit code is unaffected by `--score` — it still reflects `--fail-on` and `--min-health` as usual.

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

> Both flags filter findings by their source-file location and work correctly even when the analyzed project lives in a subdirectory of the git repo (e.g. a monorepo's `apps/web/`). If the directory isn't a git repository, git itself is unavailable, or the ref is invalid, svelte-vitals warns and analyzes the whole project instead.

### `--baseline <ref>`

Report only findings that are **new** compared to `ref` — i.e. not present when the same analysis runs against `ref`. Unlike `--diff`/`--staged` (which scope by file), `--baseline` scopes by finding identity, so pre-existing issues in files you touched don't fail the gate — only issues your change actually introduced. There is no default ref; it must be given explicitly.

Internally, svelte-vitals checks out `ref` into a temporary git worktree, analyzes it, and subtracts those findings (matched by rule id + route + location) from the current run's findings. If checkout fails (not a git repo, git unavailable, bad ref), svelte-vitals warns and reports all findings instead of failing the run.

```bash
svelte-vitals --baseline origin/main
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # recommended PR gate
```

> Findings are matched without their line number, so a second violation of the same rule added lower in a file you already had one violation in won't surface as "new".

### `svelte-vitals-suppressions.json` / `--update-suppressions` / `--no-suppressions`

Adopting svelte-vitals on an existing project usually means there's a backlog of findings you can't fix before turning on gating. `--baseline <ref>` covers the **transient** case — comparing a PR against its base — but there's also a **persistent** ramp: record today's findings once, accept them, and gate only on anything new from then on.

```bash
svelte-vitals --update-suppressions   # write svelte-vitals-suppressions.json, accepting every current finding
git add svelte-vitals-suppressions.json && git commit -m "chore: accept existing svelte-vitals findings"
svelte-vitals --fail-on warning       # now gates only on findings introduced after that commit
```

`--update-suppressions` analyzes the whole project (any `--diff`/`--staged`/`--baseline` scoping is ignored — the file is meant to capture the whole project's state, not a diff), writes every currently-penalized finding to `svelte-vitals-suppressions.json` in the analyzed directory (passing findings are never written), prints a summary to stderr, and exits `0` without printing a report.

Once the file exists, it's applied **automatically** on every run — after `--diff`/`--staged` and `--baseline` — removing any penalized finding whose rule id, route, and location match an entry, and printing how many were suppressed:

```
svelte-vitals: 12 finding(s) suppressed by svelte-vitals-suppressions.json.
```

Fix an accepted finding and its entry becomes **stale** (matches nothing); svelte-vitals reports the stale count on stderr as a reminder to prune, but never fails the run because of it:

```
svelte-vitals: 3 finding(s) suppressed by svelte-vitals-suppressions.json (1 stale entry — re-run --update-suppressions to prune).
```

Use `--no-suppressions` to ignore the file for one run (e.g. to see the project's true current state). A malformed `svelte-vitals-suppressions.json` (not valid JSON, wrong `version`, or an entry missing `id`) is a hard error (exit `2`) rather than being silently ignored — a typo'd file must not silently un-gate CI.

**Key difference from `--baseline <ref>`:** `--baseline` re-derives "what's pre-existing" by re-analyzing a git ref on every run — nothing to commit, but it only ever compares against one ref. The suppressions file is a committed, persistent record you build once (or update deliberately) and that keeps applying regardless of which ref you're on.

> Entries match without a line number, same as `--baseline` — a second violation of an accepted rule lower in the same file won't surface as new. This file only affects the CLI in v1; it isn't yet read by `@svelte-vitals/vite`, `@svelte-vitals/mcp`, or the GitHub Action.

### `--by-route`

Print a per-route score breakdown in the console output.

### `--verbose`

Show every finding uncapped and ungrouped, matching the console output from before this option existed. By default, console output groups failures by rule (showing the top 5 rules per severity, each with one example location and an "…and N more" count), collapses the Passed section to a bare count, and caps `--by-route` to the 10 worst-scoring routes.

### `--no-animation`

Disable the Health-score reveal animation and the analysis-phase mascot. Both only ever play on an interactive terminal with color enabled (never in CI, a piped/redirected output, or an AI-agent shell); this flag is only needed to opt out of them specifically while still on a terminal that would otherwise show them. The mascot art additionally needs 20+ columns and is omitted below that width even without this flag — the score animation itself still plays on a narrower terminal, just without the mascot. Falls back to a plain spinner during analysis and a plain (mascot-free) score animation.

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

### `--category <cats>`

Restrict analysis to rules in the given categories. Accepts a comma-separated list, matched case-insensitively: `seo`, `performance`, `correctness`, `security`, `architecture`.

```bash
svelte-vitals --category seo
svelte-vitals --category seo,performance
```

`--category` intersects with `--rules`/`--ignore`/config-file rule selection — a rule only runs if it survives both. Narrowing to a subset of categories also narrows the [Health score](/svelte-vitals/guides/health-report/): the combined score becomes the weighted average of only the categories that have findings, so it isn't directly comparable to an unfiltered run. An unknown category is an error (exit `2`).

### `--weights <pairs>`

Per-category weight overrides for the combined [Health score](/svelte-vitals/guides/health-report/). Accepts comma-separated `category=number` pairs; categories are matched case-insensitively. Unlisted categories default to weight `1`.

```bash
svelte-vitals --weights seo=2,performance=1
```

An unknown category or a negative/non-numeric value is an error (exit `2`).

### Suppressing a single finding inline

For one intentional occurrence that `--ignore` would silence project-wide, add a
`svelte-vitals-disable-next-line` comment on the line directly above it. Works for
any component-scoped rule (Correctness, Security, Architecture, Performance): CORRECT001–005,
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

Print the CLI's own version and the resolved `@svelte-vitals/core` version, e.g. `0.20.0 (core 0.21.0)`. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases — compare this `core` version against the one shown in the [live dashboard](/svelte-vitals/guides/dev-dashboard/#version-drift) topbar if the two surfaces ever disagree on findings.

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | No failing findings                                                         |
| `1`  | Critical finding present, or `--fail-on` / `--min-health` threshold reached |
| `2`  | Execution error (not a SvelteKit project / internal error)                  |
