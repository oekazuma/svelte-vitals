# Suppressions file: accept existing findings, gate only new ones

**Date:** 2026-07-13
**Status:** Accepted (design delegated to the advisor by the maintainer, 2026-07-13; implementation plan: `plans/023-suppressions-file.md`)
**Packages:** `svelte-vitals` (CLI only)

## Goal

Adopting svelte-vitals on an existing project is blocked by accumulated
findings: you cannot turn on `--fail-on` gating without first fixing
everything. `--baseline <ref>` (PR #142) covers the _transient_ case (compare a
PR against its base), but there is no _persistent_ ramp — "record today's
findings, accept them, and fail only on new ones". This design adds a
suppressions file (direction note DIR-03).

**Naming:** the file mechanism is called **suppressions**, not "baseline" —
`--baseline <ref>` already means the git-ref comparison, and overloading the
word was flagged as a hazard in plan 014's maintenance notes. Precedent:
ESLint's bulk suppressions.

## Decisions

1. **File:** `svelte-vitals-suppressions.json` in the analyzed directory (same
   placement rule as `svelte-vitals.config.*`; no upward search). Applied
   **automatically** when present, with a stderr notice
   (`N finding(s) suppressed by svelte-vitals-suppressions.json`).
   `--no-suppressions` disables application for one run.
2. **Creating/updating:** `--update-suppressions` runs the analysis, writes
   ALL currently penalized findings to the file (full rewrite — stale entries
   are pruned), prints a summary to stderr, and exits 0. Reporter output and
   exit gating are skipped in this mode. Scoping flags (`--diff`/`--staged`/
   `--baseline`) are ignored while updating — the file records the whole
   project.
3. **Entry identity:** same key as `--baseline`'s `findingKey`
   (`id` + `route` + `location`, **no line number** — line drift must not
   resurface accepted findings; the known trade-off is that a second violation
   of the same rule in the same file is masked).
4. **Format:** `{ "version": 1, "suppressions": [{ "id", "route"?, "location"? }] }`,
   entries sorted by (id, route, location) for stable diffs. Unknown keys are
   ignored (forward compatibility); a malformed file is a hard error (exit 2)
   — silently ignoring a typo'd suppressions file would un-gate CI.
5. **Application order:** `--diff`/`--staged` → `--baseline <ref>` →
   suppressions (last). Only penalized findings are removed; passing seeds are
   untouched. Suppressed findings leave `results` entirely, so scores/Health
   rise accordingly — intended: the ramp's purpose is to make dashboards and
   gates reflect _new_ debt only.
6. **Stale entries:** application reports a stale count on stderr (with a hint
   to re-run `--update-suppressions`) but never fails the run.

## Non-goals

- A config-file key or custom path (fixed filename in v1).
- MCP / vite / action integration (CLI only in v1).
- Line-scoped suppression or merging with the inline
  `svelte-vitals-disable-next-line` directive — separate mechanisms.

## Test plan

Unit: load (missing/malformed/version), write (penalized-only, sorted, prune),
apply (removal, passing seeds untouched, stale count). Run-level: auto-apply →
exit 0, `--no-suppressions` restores failure, `--update-suppressions` writes
and exits 0, malformed file exits 2, ordering with `--diff`/`--baseline`.
The full adoption-ramp sequence (update → all suppressed → new finding fails)
is pinned end-to-end.
