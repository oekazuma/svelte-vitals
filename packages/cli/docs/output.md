---
title: Reading the output
description: Which reporter to use, how one is auto-selected, what goes to stdout vs stderr, and what each exit code means.
---

# Reading the output

## Pick a reporter

`--reporter <fmt>`: `console` (default) · `json` · `agent` · `sarif` · `github` · `html` · `md`.

- **`agent`** — a Markdown remediation document: every failing finding with its location, a
  concrete fix (with a code snippet), and an acceptance check. This is the one to use when
  something will act on the findings rather than read them.
- **`json`** — the full structured report (per-route and site-wide scores, every finding with
  `fix`, `recommendation` and `docsUrl`). Use it when you need to filter or count.
- **`console`** — for a human at a terminal. Grouped and capped; add `--verbose` for everything.
- **`md`** — a compact summary table for a PR comment or job summary (capped at 50 rows).
- **`sarif`** — SARIF v2.1, for GitHub Code Scanning and other SAST tooling.
- **`github`** — `::error` / `::warning` workflow annotations.
- **`html`** — a self-contained report file; `--out-file <path>`, or `--out-file -` for stdout.

## Auto-selection

First match wins:

1. an explicit `--reporter <fmt>`
2. `SVELTE_VITALS_REPORTER=<fmt>`
3. a known AI-agent environment (e.g. `CLAUDECODE` is set) → `agent`
4. `GITHUB_ACTIONS=true` → `github`
5. otherwise → `console`

So inside an agent harness you usually get `agent` without asking. When it is auto-selected
rather than requested, a one-line hint goes to stderr explaining how to override.

## stdout vs stderr

The report goes to **stdout**. Diagnostics — auto-selection hints, suppression counts,
app-detection notices, warnings, errors — go to **stderr**. Piping stdout is safe; you will not
get diagnostics mixed into the report.

`--reporter html` is the exception: it writes a file and prints the path to stderr, unless you
pass `--out-file -`.

## Exit codes

| Code | Meaning                                                                    |
| ---- | -------------------------------------------------------------------------- |
| `0`  | no failing findings                                                        |
| `1`  | a critical finding is present, or `--fail-on` / `--min-health` was reached |
| `2`  | execution error — not a SvelteKit project, bad flag, unreadable config     |

`1` means "the code has problems". `2` means "the run did not happen" — never treat `2` as a
clean result. `--fail-on <critical|warning|info>` lowers the bar for `1`; `--min-health <0-100>`
adds a score gate.

## Related

- `svelte-vitals docs show scoping` — report only what a change introduced
- `svelte-vitals explain <rule-id>` — one rule's rationale, fix and options
