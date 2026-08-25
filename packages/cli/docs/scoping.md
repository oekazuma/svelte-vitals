---
title: Scoping findings to a change
description: Use --diff, --staged, --baseline and the suppressions file so only what a change introduced is reported, instead of a legacy backlog.
---

# Scoping findings to a change

An existing project usually has a backlog nobody is about to fix. Scope the report rather than
disabling rules.

## Scope by file

- `--diff [ref]` — only findings in files changed versus `ref` (default `HEAD`).
- `--staged` — only findings in staged files. The pre-commit gate.

```bash
svelte-vitals . --diff --reporter agent   # after editing: what did I just break?
svelte-vitals . --staged                  # before committing
```

Both work when the project is not at the git repo root.

## Scope by finding (`--baseline <ref>`)

Reports only findings **not already present** at `ref`. Scopes by finding identity rather than by
file, so a pre-existing problem in a file you touched does not fail the gate. No default ref.

```bash
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # PR gate
```

It checks `ref` out into a temporary worktree and subtracts those findings. On failure (no git,
bad ref) it warns and reports everything rather than failing the run.

## Accept a backlog once (`svelte-vitals-suppressions.json`)

`--baseline` handles the transient case. For a persistent ramp, record today's findings once:

```bash
svelte-vitals --update-suppressions
git add svelte-vitals-suppressions.json
```

This analyzes the whole project (`--diff`/`--staged`/`--baseline` are ignored), writes every
penalized finding, and exits `0` without a report.

The file then applies automatically on every run, after `--diff`/`--staged` and `--baseline`.
Fixing an accepted finding leaves a **stale** entry, reported on stderr but never failing the run.
`--no-suppressions` ignores the file for one run.

An entry covers whatever its rule reports at that route and location, not just the message
recorded when written — a different finding from the same rule at the same spot still matches
and stays suppressed (and not stale).

A malformed suppressions file is a hard error (exit `2`), not a silent skip.

## Suppress one occurrence inline

For a single finding that is correct by design, put a `svelte-vitals-disable-next-line` comment on
the line directly above it:

```html
<!-- svelte-vitals-disable-next-line security/raw-html -->
<div>{@html sanitized}</div>
```

Inside `<script>`, use `// svelte-vitals-disable-next-line <rule-id>`. Omit the id to suppress every
rule on the next line, or list several comma-separated.

Only findings the report anchors to a **line** can be reached this way — not the `<head>` metadata
rules, which report what a route never set. A directive in a component silences that finding on
every route composing it; for one route, use the suppressions file or `overrides`.

## Which one

| Situation                              | Use                                      |
| -------------------------------------- | ---------------------------------------- |
| Checking an edit you just made         | `--diff`                                 |
| One occurrence that is right as-is     | `svelte-vitals-disable-next-line`        |
| Pre-commit hook                        | `--staged`                               |
| PR gate against a base branch          | `--diff <base> --baseline <base>`        |
| Adopting on a legacy project, for good | `--update-suppressions`, commit the file |

Matching ignores line numbers in both `--baseline` and the suppressions file, so a second
violation of the same rule lower in the same file does not surface as new.

## Related

- `svelte-vitals docs show ci` — the generated PR gate already does the `--diff`/`--baseline` pairing
- `svelte-vitals docs show config` — turning a rule off for good, when that is genuinely right
