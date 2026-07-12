# Design: v1.0 cleanup — remove CLI alias flags, merge the perf/performance rule directories

**Date:** 2026-07-12
**Status:** Accepted (maintainer-approved in session)
**Packages:** `svelte-vitals` (CLI), `@svelte-vitals/core` (internal reorg only)

## Goal

Two independent, small pre-1.0 cleanups the maintainer asked to bundle together before release, following the same "no compat needed pre-1.0" posture used for the dev-overlay removal (`2026-07-12-retire-dev-overlay-design.md`):

1. **Remove `--json` and `--fail-on-warning`**, the CLI's two boolean alias flags. Both do nothing `--reporter=json` / `--fail-on=warning` don't already do — `bin.ts`'s own help text literally labels them "Alias for …" — so they're pure flag-surface duplication with no independent behavior.
2. **Merge `packages/core/src/rules/perf/` and `packages/core/src/rules/performance/`** into one directory. `AGENTS.md` already documents this split as a self-acknowledged wart: "for historical reasons performance rules are split across `rules/perf/` (PERF001–008) and `rules/performance/` (PERF009–010) — check both when looking for an existing PERF rule."

Unlike the dev-overlay removal, the CLI aliases have no adoption-level evidence either way (they're ordinary, longstanding flags, not an internal dev-only feature) — the maintainer explicitly chose removal anyway or pre-1.0, rather than a deprecation-warning period.

## Decisions (maintainer-approved)

1. **CLI aliases: remove outright, no deprecation period.** No warning-then-remove staging — pre-1.0, breaking the two flags now is acceptable. `--reporter json` / `--fail-on warning` (the flags they aliased) are unaffected and remain the only way to select those settings.
2. **Rules merge: move the 2 `performance/` files into `perf/`, not the reverse.** `perf/` already holds 7 of the 10 PERF rule files; moving the smaller side (`performance/`'s 2 files) into the larger, established directory is the minimal diff. `perf/` becomes the sole PERF-rule directory; `performance/` is deleted.
3. **Rules merge is directory-location-only — no file-granularity change.** `perf/images.ts` and `perf/resource-hints.ts` each bundle multiple rule IDs in one file (PERF001+002+006, PERF003+004 respectively), which looks inconsistent with the one-file-per-rule pattern `performance/`'s two files follow. Investigation found this bundling is the codebase's **normal, established pattern** — `rules/seo/` does the same thing (`seo002-005-008.ts`, `seo010-015.ts`, `seo016-021.ts`, etc.). Splitting `images.ts`/`resource-hints.ts` into one-file-per-rule would be an unrelated, larger, unrequested refactor against the codebase's own grain — explicitly out of scope.

## Components

### CLI alias removal

- **`packages/cli/src/resolve-args.ts`** — drop the `if (argv.json) { reporter = 'json'; }` branch (keep the `else if (typeof argv.reporter === 'string')` branch as the sole path), drop `argv['fail-on-warning'] ? 'warning' :` from the `failOn` ternary, drop `argv.json ||` from the `--score` + reporter interaction warning's condition.
- **`packages/cli/src/bin.ts`** — remove the `--json` and `--fail-on-warning` lines from `HELP`, remove `'json'` and `'fail-on-warning'` from the `mri(...).boolean` array.
- **`packages/cli/test/resolve-args.test.ts`** — remove `'json'`/`'fail-on-warning'` from the local `resolve()` helper's `boolean` array; delete the two tests that exist solely to verify the aliases (`'lets --fail-on-warning override the threshold'`, `'maps --json to the json reporter'`); delete `'warns when --score is combined with --json'` (redundant with the adjacent `'warns when --score is combined with --reporter'`, which already covers the same `score && reporter` code path via `--reporter md`); replace the six unrelated tests that used `--json` purely as a convenient way to get a resolved, non-null `options` object with `--reporter json` (same observable effect, doesn't depend on the removed alias).
- **Docs** (`docs/src/content/docs/guides/cli.md` + ja, `docs/src/content/docs/guides/reporters.md` + ja) — remove the `### --json` / `### --fail-on-warning` sections from `cli.md`; fix the "Combining `--score` with `--reporter`/`--json`" sentence to drop `/--json`; remove the `# or use the alias: svelte-vitals --json` two lines from `reporters.md`'s `json` example; change `reporters.md`'s CI-pipeline example from `--fail-on-warning` to `--fail-on warning`.

### Rules directory merge

- **`packages/core/src/rules/performance/perf009-heavy-import.ts`** → moved to `packages/core/src/rules/perf/perf009-heavy-import.ts` (`git mv`, content unchanged).
- **`packages/core/src/rules/performance/perf010-namespace-import.ts`** → moved to `packages/core/src/rules/perf/perf010-namespace-import.ts` (`git mv`, content unchanged).
- **`packages/core/src/rules/index.ts`** — update the two import paths from `./performance/perf00{9,10}-*.js` to `./perf/perf00{9,10}-*.js`. No other change — `allRules`, the re-export block, and every rule name are untouched.
- **`packages/core/src/index.ts`** — no change needed. Its re-export block imports names from `./rules/index.js` only, never a per-rule path — confirmed no path-based reference to either directory exists anywhere outside `rules/index.ts` (`grep -rn "rules/performance\b" --include="*.ts"` outside `rules/index.ts` returns nothing).
- **`AGENTS.md`** — remove the sentence documenting the split ("for historical reasons performance rules are split across… check both when looking for an existing PERF rule"), since it will no longer be true.
- No test file imports rule modules by path (confirmed via grep of `packages/core/test/`) — all rule tests go through the public `allRules` export or rule ids, so no test changes are needed for the merge itself.

## Non-goals

- Splitting `perf/images.ts` or `perf/resource-hints.ts` into one-file-per-rule — matches the codebase's established multi-rule-per-file convention (see `rules/seo/`), not a defect.
- Any deprecation warning or grace period for the removed CLI aliases — pre-1.0, direct removal is authorized.
- Any change to `--reporter`, `--fail-on`, or any other CLI flag not named above.
- Any change to rule behavior, rule ids, or rule docs (`docs/src/content/docs/rules/perf009.md` etc.) — this is a source-file relocation only.

## Testing

- **CLI**: `pnpm --filter svelte-vitals test` — `resolve-args.test.ts` (updated) plus a full-package run to catch any other stray `--json`/`--fail-on-warning` reference the investigation missed. `pnpm --filter svelte-vitals typecheck` and `build`.
- **Core**: `pnpm --filter @svelte-vitals/core test` — full suite must stay green with zero changes to any test file, since the merge changes no behavior (a green, unmodified `bundle-rules.test.ts` and any PERF009/010-specific test is the actual proof the merge is behavior-preserving). `pnpm --filter @svelte-vitals/core typecheck` and `build`.
- **Docs**: `pnpm --filter docs build` after the doc edits, plus a repo-wide grep for `--json\b|--fail-on-warning\b` (excluding `CHANGELOG.md` and `docs/superpowers/`) to confirm no stray mention survives.
- **Whole repo**: `pnpm build && pnpm typecheck && pnpm test && pnpm lint` as the final gate (matching `AGENTS.md`'s CI job list).

## Release

- **`svelte-vitals`**: **minor** changeset — the CLI alias removal is a user-facing breaking change to the flag surface (pre-1.0 semver convention already established in this repo's specs).
- **`@svelte-vitals/core`**: **no changeset** — the rules-directory merge is a pure internal reorg with zero public API or behavior change, matching `AGENTS.md`'s "Internal-only / doc-only changes don't need one."

## Documentation

- `docs/src/content/docs/guides/cli.md` + ja: remove the two alias sections, fix the `--score` interaction sentence.
- `docs/src/content/docs/guides/reporters.md` + ja: remove the `--json` alias mention, switch the CI example to `--fail-on warning`.
- `AGENTS.md`: remove the now-stale perf/performance split note.
