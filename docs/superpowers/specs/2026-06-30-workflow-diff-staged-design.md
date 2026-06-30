# Workflow ergonomics — `--diff` / `--staged` (changed-file gating)

**Date:** 2026-06-30
**Status:** Approved (per maintainer; next slice of #69)
**Packages:** `@svelte-vitals/cli` only (no core/rule changes)

## Goal

Let the CLI gate **only the files that changed** — so it can run as a pre-commit
hook or PR check that catches "what the agent just wrote" without drowning in
pre-existing findings across the whole app. The signature agent-native workflow.

- `--staged` — report only findings in files staged for commit (`git diff --cached`).
- `--diff [ref]` — report only findings in files changed vs `ref` (working tree;
  default `HEAD` = uncommitted changes; e.g. `--diff main` for branch changes).

## Design (CLI-only)

### Changed-file resolution (`changed-files.ts`)

`getChangedFiles(cwd, { staged?, base? })` runs git via `node:child_process` and
returns a `Set` of repo-relative POSIX paths, or `undefined` on any failure (not a
git repo, git missing, bad ref). Deleted files are excluded (`--diff-filter=d`).

- `--staged`: `git diff --name-only --cached --diff-filter=d`.
- `--diff`: `git diff --name-only --diff-filter=d --merge-base <base>` (so
  `--diff main` is branch-introduced changes, not files only changed on `main`),
  **unioned with** `git ls-files --others --exclude-standard` (untracked/new files
  — a "gate what changed" run must catch brand-new components).

### Filtering (`run()` in `index.ts`)

`run()` already calls `analyzeProject()` (shared with MCP — left untouched, no
git there). After analysis, when `--staged`/`--diff` is set:

1. Resolve the changed set; if `undefined`, print a warning and analyze everything
   (don't silently pass).
2. `filterToChangedFiles(results, changed)` keeps results whose `location` is in
   the set. Findings without a `location` (project-scoped, e.g. robots/sitemap)
   and passing "seed" results (no location) are dropped — the gate reports issues
   **in the changed files**. The filtered results flow through scoring, summary,
   reporters, and the fail-on/min-health gates unchanged.

Path note: `location` is project-root-relative; git paths are repo-root-relative.
v1 assumes project root == git root (the common case); documented.

## CLI surface

- mri: `diff` (string — `--diff` alone → `''`; `--diff main` → `'main'`), `staged`
  (boolean). `resolveArgs` maps to `RunOptions.diffBase?: string` (bare `--diff` →
  `'HEAD'`; `undefined` = no gating) and `staged?: boolean`. `--staged` wins if both.
- HELP + exit codes documented. Changeset `svelte-vitals` minor.

## Testing

- `filterToChangedFiles` (pure): keeps location-in-set, drops location-less and
  out-of-set.
- `resolveArgs`: `--diff`, `--diff main`, `--staged` produce the right options.
- (git `getChangedFiles` is integration-only; kept thin and not unit-tested.)
- Full `pnpm -r test` + typecheck + lint green.

## Out of scope

- Layout-chain awareness (a changed `+layout.svelte` surfacing affected routes
  whose finding `location` is the `+page`). v1 matches by finding `location` only.
- Per-rule agent-ready fix prompts (separate slice).
