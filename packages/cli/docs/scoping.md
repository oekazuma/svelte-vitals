---
title: Scoping findings to a change
description: Use --diff, --staged, --baseline and the suppressions file so only what a change introduced is reported, instead of a legacy backlog.
---

# Scoping findings to a change

Running svelte-vitals on an existing project usually surfaces a backlog nobody is about to fix.
Do not disable rules to get a green run — scope the report instead.

## Scope by file

- **`--diff [ref]`** — only findings in files changed versus `ref` (default `HEAD`).
- **`--staged`** — only findings in staged files. The pre-commit gate.

```bash
svelte-vitals . --diff --reporter agent   # after editing: what did I just break?
svelte-vitals . --staged                  # before committing
```

Both work when the project is not at the git repo root.

## Scope by finding (`--baseline <ref>`)

`--baseline` reports only findings **not already present** at `ref`. It scopes by finding
identity rather than by file, so a pre-existing problem in a file you touched does not fail the
gate — only what your change actually introduced does. There is no default ref.

```bash
svelte-vitals --diff origin/main --baseline origin/main --fail-on warning   # PR gate
```

Internally it checks `ref` out into a temporary git worktree and subtracts those findings. If
that fails (no git, bad ref), it warns and reports everything rather than failing the run.

## Accept a backlog once (`svelte-vitals-suppressions.json`)

`--baseline` handles the transient case. For a persistent ramp, record today's findings once:

```bash
svelte-vitals --update-suppressions
git add svelte-vitals-suppressions.json
```

`--update-suppressions` analyzes the whole project (any `--diff`/`--staged`/`--baseline` scoping
is ignored), writes every currently-penalized finding, prints a summary to stderr, and exits `0`
without printing a report.

Once the file exists it applies automatically on every run, after `--diff`/`--staged` and
`--baseline`, and reports how many findings it removed. Fixing an accepted finding leaves a
**stale** entry — that is reported on stderr as a reminder to re-run `--update-suppressions`,
but never fails the run. `--no-suppressions` ignores the file for one run.

A malformed suppressions file is a hard error (exit `2`), not a silent skip.

## Which one

| Situation                              | Use                                      |
| -------------------------------------- | ---------------------------------------- |
| Checking an edit you just made         | `--diff`                                 |
| Pre-commit hook                        | `--staged`                               |
| PR gate against a base branch          | `--diff <base> --baseline <base>`        |
| Adopting on a legacy project, for good | `--update-suppressions`, commit the file |

Matching ignores line numbers in both `--baseline` and the suppressions file, so a second
violation of the same rule lower in the same file does not surface as new.

## Related

- `svelte-vitals docs show ci` — the generated PR gate already does the `--diff`/`--baseline` pairing
- `svelte-vitals docs show config` — turning a rule off for good, when that is genuinely right
