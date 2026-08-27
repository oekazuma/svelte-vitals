---
title: Reading the output
description: Which reporter to use, how one is auto-selected, what goes to stdout vs stderr, and what each exit code means.
---

# Reading the output

## Pick a reporter

`--reporter <fmt>`: `console` (default) · `json` · `agent` · `sarif` · `github` · `html` · `md`.

- `agent`: a Markdown remediation document. Each failing finding with its location, a concrete fix
  (with snippet), and an acceptance check. Use this when something will act on the findings.
- `json`: the full structured report (scores per route and site-wide; every finding with
  `fix`, `recommendation`, `docsUrl`). Use it to filter or count.
- `console`: for a human. Grouped and capped; `--verbose` for everything.
- `md`: a compact summary table for a PR comment or job summary (capped at 50 rows).
- `sarif`: SARIF v2.1, for GitHub Code Scanning and other SAST tooling.
- `github`: `::error` / `::warning` workflow annotations.
- `html`: a self-contained report file; `--out-file <path>`, or `--out-file -` for stdout.

## Auto-selection

First match wins:

1. an explicit `--reporter <fmt>`
2. `SVELTE_VITALS_REPORTER=<fmt>`
3. a recognized AI-agent harness (Claude Code, Cursor, Codex, and others; detection is
   delegated to gunshi's agent profile and evolves with it) or `SVELTE_VITALS_AGENT=1` set → `agent`
4. `GITHUB_ACTIONS=true` → `github`
5. otherwise → `console`

Inside an agent harness you get `agent` without asking; a one-line override hint goes to stderr.

## stdout vs stderr

The report goes to **stdout**; every diagnostic goes to **stderr**: hints, suppression counts, app-detection
notices, warnings, errors. Piping stdout never mixes the two.

`--reporter html` is the exception: it writes a file and prints the path to stderr, unless you
pass `--out-file -`.

## Exit codes

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `0`  | no failing findings                                                        |
| `1`  | a critical finding is present, or `--fail-on` / `--min-health` was reached |
| `2`  | execution error: not a SvelteKit project, bad flag, unreadable config      |

`2` is never a clean result; the run did not happen. `--fail-on <critical|warning|info>` lowers
the bar for `1`; `--min-health <0-100>` adds a score gate.

## Related

- `svelte-vitals docs show scoping`: report only what a change introduced
- `svelte-vitals explain <rule-id>`: one rule's rationale, fix and options
