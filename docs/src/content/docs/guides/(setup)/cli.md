---
title: CLI reference
description: Complete reference for all svelte-vitals command-line flags.
sidebar:
  order: 1
---

## Usage

```bash
svelte-vitals [path] [options]
svelte-vitals docs list
svelte-vitals docs show <name>
svelte-vitals explain <rule-id>
```

`path` is optional and defaults to the current directory. [`docs`](#docs) prints the guides that
ship inside the CLI, and [`explain`](#explain) prints a single rule's rationale, fix, and
configurable options — neither analyzes a project.

> There is also an [`install` subcommand](/guides/install) for setting up [Agent Skills](/guides/agent-skills), the Vite integration, and the config file, and a `ci install` subcommand that scaffolds a GitHub Actions PR gate — see [CI integration](/guides/ci).

Flags below can also be set once in a `svelte-vitals.config` file at the project root instead of being repeated on every invocation — see [Config file](/guides/configuration). A flag always overrides the config file.

## Monorepos

Passing an explicit `path` (or running inside the app directory itself) always takes priority — svelte-vitals never second-guesses a target you named.

When no `path` is given and the current directory isn't a SvelteKit app, svelte-vitals looks for SvelteKit apps nearby — a directory with `src/routes` and either a `svelte.config.{js,ts}` or a `package.json` declaring `@sveltejs/kit` (current `sv create` output folds the SvelteKit config into `vite.config.ts` and emits no `svelte.config` file) — instead of failing immediately:

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

Every flag `svelte-vitals --help` prints, generated from the CLI's own argument declarations —
see below each row for usage notes, defaults, and examples.

<!-- cli-reference:start -->

| Flag                                    | Description                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--meta-components <meta-components>`   | Comma-separated component names that emit head metadata                                                                  |
| `--treat-dynamic-as <treat-dynamic-as>` | pass \| warn \| fail (default: pass)                                                                                     |
| `--route <route>`                       | Only analyze routes matching this glob                                                                                   |
| `--diff <diff>`                         | Report only findings in files changed vs ref (default HEAD; e.g. --diff main)                                            |
| `--staged`                              | Report only findings in files staged for commit (pre-commit gate)                                                        |
| `--baseline <baseline>`                 | Report only findings not present at ref (compare against e.g. origin/main)                                               |
| `--update-suppressions`                 | Write svelte-vitals-suppressions.json accepting all current findings (introduce gates on legacy projects)                |
| `--no-suppressions`                     | Ignore svelte-vitals-suppressions.json for this run                                                                      |
| `--by-route`                            | Show per-route score breakdown in console output                                                                         |
| `--reporter <reporter>`                 | console \| json \| agent \| sarif \| github \| html \| md (auto: agent under AI-agent envs, github under GitHub Actions) |
| `--out-file <out-file>`                 | Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)                                     |
| `--fail-on <fail-on>`                   | Fail (exit 1) when any finding reaches this severity: critical \| warning \| info                                        |
| `--min-health <min-health>`             | Fail (exit 1) when the combined Health score is below this value (0-100)                                                 |
| `--rules <rules>`                       | Comma-separated rule ids to enable (all others disabled)                                                                 |
| `--ignore <ignore>`                     | Comma-separated rule ids to disable                                                                                      |
| `--category <category>`                 | Comma-separated categories to analyze: seo \| performance \| correctness \| security \| architecture \| a11y             |
| `--weights <weights>`                   | Per-category Health weight overrides, e.g. seo=2,performance=1 (unlisted categories default to 1)                        |
| `--score`                               | Print only the combined Health score (works with --min-health for gating)                                                |
| `--no-color`                            | Disable ANSI color in console output                                                                                     |
| `--no-animation`                        | Disable the Health-score reveal animation and mascot on an interactive terminal                                          |
| `--verbose`                             | Show every finding uncapped and ungrouped (default: capped, grouped by rule)                                             |
| `-h, --help`                            | Show this help                                                                                                           |
| `-v, --version`                         | Show version                                                                                                             |

<!-- cli-reference:end -->

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

**Auto-selection:** when run inside a recognized AI-agent harness (Claude Code, Cursor, Codex, and others — the recognized list is delegated to [gunshi](https://gunshi.dev)'s agent profile and evolves with it) or with `SVELTE_VITALS_AGENT=1` set, the `agent` reporter is selected automatically. When run inside GitHub Actions (`GITHUB_ACTIONS=true`), the `github` reporter is selected automatically. An explicit `--reporter` flag always overrides auto-selection. You can also override via the `SVELTE_VITALS_REPORTER` environment variable.

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

See [Health score](/guides/health-report) for how the score is calculated.

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

**What a suppression covers:** an entry means _accept whatever this rule reports at this route and location_, not _accept this one message_. The key is `id` + `route` + `location` — deliberately no message — so fixing the finding an entry was recorded for and then triggering a different finding from the same rule at the same spot still matches the entry: the new finding is suppressed too, and the entry stays out of the stale count because it's still actively matching something. An entry only goes stale once nothing at all matches it. Prune deliberately with `--update-suppressions` rather than assuming a green run means that exact issue is gone.

Use `--no-suppressions` to ignore the file for one run (e.g. to see the project's true current state). A malformed `svelte-vitals-suppressions.json` (not valid JSON, wrong `version`, or an entry missing `id`) is a hard error (exit `2`) rather than being silently ignored — a typo'd file must not silently un-gate CI.

**Key difference from `--baseline <ref>`:** `--baseline` re-derives "what's pre-existing" by re-analyzing a git ref on every run — nothing to commit, but it only ever compares against one ref. The suppressions file is a committed, persistent record you build once (or update deliberately) and that keeps applying regardless of which ref you're on.

> Entries match without a line number, same as `--baseline` — a second violation of an accepted rule lower in the same file won't surface as new. This file only affects the CLI in v1; it isn't yet read by `@svelte-vitals/vite` or the GitHub Action.

### `--by-route`

Print a per-route score breakdown in the console output.

### `--verbose`

Show every finding uncapped and ungrouped, matching the console output from before this option existed. By default, console output groups failures by rule (showing the top 5 rules per severity, each with one example location and an "…and N more" count), collapses the Passed section to a bare count, and caps `--by-route` to the 10 worst-scoring routes.

### `--no-animation`

Disable the Health-score reveal animation and the analysis-phase mascot, falling back to a plain spinner and a plain score reveal.

Both only ever play on an interactive, color-capable terminal — never in CI, piped output, or an AI-agent shell — so this flag is only for opting out on a terminal that would otherwise show them. The mascot additionally needs 20+ columns and is dropped below that width regardless.

### `--rules <ids>`

Enable only the specified rules; all others are disabled. Accepts a comma-separated list of rule IDs.

```bash
svelte-vitals --rules seo/title-presence,seo/description-presence
```

### `--ignore <ids>`

Disable the specified rules. Accepts a comma-separated list of rule IDs.

```bash
svelte-vitals --ignore performance/image-dimensions
```

### `--category <cats>`

Restrict analysis to rules in the given categories. Accepts a comma-separated list, matched case-insensitively: `seo`, `performance`, `correctness`, `security`, `architecture`, `a11y`.

```bash
svelte-vitals --category seo
svelte-vitals --category seo,performance
```

`--category` intersects with `--rules`/`--ignore`/config-file rule selection — a rule only runs if it survives both. Narrowing to a subset of categories also narrows the [Health score](/guides/health-report): the combined score becomes the weighted average of only the categories that have findings, so it isn't directly comparable to an unfiltered run. An unknown category is an error (exit `2`).

### `--weights <pairs>`

Per-category weight overrides for the combined [Health score](/guides/health-report). Accepts comma-separated `category=number` pairs; categories are matched case-insensitively. Unlisted categories default to weight `1`.

```bash
svelte-vitals --weights seo=2,performance=1
```

An unknown category or a negative/non-numeric value is an error (exit `2`).

### Suppressing a single finding inline

For one intentional occurrence that `--ignore` would silence project-wide, add a
`svelte-vitals-disable-next-line` comment on the line directly above it. Works for
every rule that reports against a source file — the Correctness, Security, and
Architecture rules, the component-scoped Performance rules, and the component-scoped
Accessibility rules (ARIA validity, interactive nesting, accessible names, labels).
(Route-level SEO rules, and the cross-component Accessibility rules — landmarks, id
references, the doctype check — resolve across files, so they can't be silenced this
way.)

```svelte
<script>
  // The prerendered HTML always renders this hidden; canVibrate() must run only
  // after mount, or hydration mismatches. $derived would re-run during hydration.
  // svelte-vitals-disable-next-line correctness/effect-as-derived
  $effect(() => {
    mounted = true;
  });
</script>
```

In markup, use an HTML comment instead:

```html
<!-- svelte-vitals-disable-next-line security/raw-html -->
<div>{@html trustedMarkup}</div>
```

Omit the rule id to suppress every rule on the next line, or list several
comma-separated (`correctness/effect-as-derived, security/raw-html`).

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

Print the help text and exit. Renders in Japanese when the resolved locale is `ja` — see
[Help language](#help-language) below. Every other output (errors, warnings, reporters) stays
English regardless of locale.

#### Help language

`--help` picks English or Japanese from the environment — POSIX-style, first non-empty value wins:
`SVELTE_VITALS_LANG` > `LC_ALL` > `LC_MESSAGES` > `LANG`. A value of `ja`, `ja-JP`, or `ja_JP.UTF-8`
selects Japanese; anything else (including unset) selects English. There is no `--lang` flag — the
environment already expresses this on every terminal.

```bash
SVELTE_VITALS_LANG=ja svelte-vitals --help
LANG=ja_JP.UTF-8 svelte-vitals docs --help
```

### `-v, --version`

Print the CLI's own version and the resolved `@svelte-vitals/core` version, e.g. `0.20.0 (core 0.21.0)`. `svelte-vitals` and `@svelte-vitals/vite` are versioned independently and can end up depending on different `@svelte-vitals/core` releases — compare this `core` version against the one shown in the [live dashboard](/guides/dev-dashboard#version-drift) topbar if the two surfaces ever disagree on findings.

## `docs`

```bash
svelte-vitals docs list [--json]
svelte-vitals docs show <name>
```

A curated set of guides is **bundled into the CLI itself**, so what you read always matches the
version you are running and works with no network. `docs list` prints each topic with a one-line
description (`--json` for the machine-readable form); `docs show <name>` prints one.

```bash
npx svelte-vitals docs show scoping
```

The set covers the things you need while running the tool, condensed for a terminal — run
`docs list` for the current topics rather than trusting a list written down elsewhere. This site
remains the complete reference; the bundled set is deliberately smaller.

This matters most for AI agents, which otherwise guess at flags or fetch a docs page that may
describe a different version. `svelte-vitals --version` prints a pointer to `docs list` on stderr
for the same reason.

An unknown topic exits `2` and lists the valid names.

## `explain`

```bash
svelte-vitals explain --list [--json]
svelte-vitals explain <rule-id> [--json]
```

`--list` prints every rule grouped by category, with its default severity and title — the way to
discover rule ids without triggering an error.

Given an id, `explain` prints that rule's static metadata without analyzing anything: title,
category, default severity, rationale, docs URL, fix template, and — for a configurable rule —
each option's name, kind, default, bounds and **merge semantics**.

That last part is the piece a finding can't tell you: `integer` replaces the default,
`string-list` appends to it, `string-map` is spread over it, so a built-in key has its value
overridden rather than duplicated.

```bash
npx svelte-vitals explain performance/heavy-import
```

`--json` prints the same information as a JSON object instead of text, for an agent or script
that wants to read it structurally.

An unknown rule id exits `2` and lists every known id, so a near-miss is easy to correct. Rule
ids are matched exactly and are case-sensitive.

## Shell completion

```bash
svelte-vitals complete <bash|zsh|fish|powershell>
```

Prints a completion script for the given shell: sub-command names (`docs`, `explain`, `install`,
`ci install`/`ci upgrade`), every flag on each, and values for the enum-ish flags (`--reporter`,
`--fail-on`, `--category`, `--treat-dynamic-as`). Generated from the same argument declarations
that drive parsing and `--help`, so completions stay in sync with the CLI automatically.

**Bash**

```bash
mkdir -p ~/.local/share/bash-completion/completions
svelte-vitals complete bash > ~/.local/share/bash-completion/completions/svelte-vitals
source ~/.bashrc
```

**Zsh**

```bash
mkdir -p ~/.zsh/completions
echo 'fpath=(~/.zsh/completions $fpath)' >> ~/.zshrc
echo 'autoload -U compinit && compinit' >> ~/.zshrc
svelte-vitals complete zsh > ~/.zsh/completions/_svelte-vitals
exec zsh
```

**Fish**

```bash
mkdir -p ~/.config/fish/completions
svelte-vitals complete fish > ~/.config/fish/completions/svelte-vitals.fish
```

**PowerShell**

```powershell
svelte-vitals complete powershell >> $PROFILE
. $PROFILE
```

Each script re-invokes `svelte-vitals` from the exact install location it was generated from —
regenerate it after upgrading `svelte-vitals`, or after moving/reinstalling the package.

`complete` is a subcommand, so it wins over a directory of the same name: to analyze a directory
called `complete`, write `svelte-vitals ./complete`.

## Supported Svelte/SvelteKit versions

Rules assume **Svelte 5+ (runes)** and **SvelteKit 2+**. If the analyzed project declares an
older `svelte` or `@sveltejs/kit` version in `package.json`, a warning is printed to stderr —
the analysis still runs normally, but rules that key off runes syntax (e.g.
[correctness/stale-prop-derivation](/rules/correctness/stale-prop-derivation),
[correctness/prop-mutation](/rules/correctness/prop-mutation)) can't recognize
the legacy (`export let` / `$:`) equivalent of the same bugs, so findings may be incomplete for
components that haven't migrated to runes yet.

## Exit codes

| Code | Meaning                                                                     |
| ---- | --------------------------------------------------------------------------- |
| `0`  | No failing findings                                                         |
| `1`  | Critical finding present, or `--fail-on` / `--min-health` threshold reached |
| `2`  | Execution error (not a SvelteKit project / internal error)                  |
