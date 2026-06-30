---
'svelte-vitals': minor
---

Add `--diff` and `--staged` to scope findings to changed files (#69) — run
svelte-vitals as a pre-commit hook or PR check that gates only what just changed:

- `--staged` — report only findings in files staged for commit.
- `--diff [ref]` — report only findings in files changed vs `ref` (default
  `HEAD`; e.g. `--diff main` for branch changes).

Findings are filtered to those located in the changed files, then flow through
scoring, the reporters, and the `--fail-on` / `--min-health` gates. If git can't
answer (not a repo / unavailable), it warns and analyzes everything.
