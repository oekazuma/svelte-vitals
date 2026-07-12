# v1.0 cleanup: remove CLI aliases, merge rule directories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the CLI's `--json`/`--fail-on-warning` alias flags entirely, and merge `packages/core/src/rules/performance/` into `packages/core/src/rules/perf/` so all PERF rules live in one directory.

**Architecture:** Two independent, small changes with no interface between them — Task 1 touches only `packages/cli`, Task 2 touches only `packages/core`. Each is TDD-able and independently testable.

**Tech Stack:** TypeScript, `mri` (CLI arg parsing), vitest, Astro Starlight docs.

## Global Constraints

- No deprecation period for the removed CLI aliases — direct removal, pre-1.0 (spec: `docs/superpowers/specs/2026-07-12-v1-cleanup-aliases-and-rules-merge-design.md`, Decision 1).
- `--reporter json` and `--fail-on warning` (the flags the aliases pointed at) are untouched and remain fully functional.
- The rules merge is a directory move only — no rule file is split or restructured beyond changing its containing directory (Decision 3). Do not split `perf/images.ts` or `perf/resource-hints.ts` into one-file-per-rule; that is explicitly out of scope.
- `packages/core/src/index.ts` needs no change for the rules merge (it re-exports by name from `./rules/index.js`, never by per-rule path).
- `svelte-vitals` gets a `minor` changeset for the alias removal. `@svelte-vitals/core` gets **no changeset** for the rules merge (pure internal reorg, `AGENTS.md`'s "Internal-only / doc-only changes don't need one").
- en/ja docs stay in sync (`AGENTS.md`).

---

### Task 1: Remove the `--json` and `--fail-on-warning` CLI aliases

**Files:**
- Modify: `packages/cli/src/resolve-args.ts`
- Modify: `packages/cli/src/bin.ts`
- Modify: `packages/cli/test/resolve-args.test.ts`
- Modify: `docs/src/content/docs/guides/cli.md`
- Modify: `docs/src/content/docs/ja/guides/cli.md`
- Modify: `docs/src/content/docs/guides/reporters.md`
- Modify: `docs/src/content/docs/ja/guides/reporters.md`
- Create: `.changeset/remove-cli-aliases.md`

**Interfaces:** None — this task doesn't change any exported function signature. `resolveArgs`'s behavior for `--reporter`/`--fail-on`/`--score` is unchanged; only the now-removed aliases stop working.

- [ ] **Step 1: Update the failing tests first — delete the two alias-specific tests and the redundant `--score` + `--json` test**

In `packages/cli/test/resolve-args.test.ts`, delete this test (currently lines 54-58):

```ts
  it('lets --fail-on-warning override the threshold', () => {
    const { options, warnings } = resolve('--fail-on-warning');
    expect(options?.failOn).toBe('warning');
    expect(warnings).toEqual([]);
  });

```

Delete this test (currently lines 77-80):

```ts
  it('maps --json to the json reporter', () => {
    const { options } = resolve('--json');
    expect(options?.reporter).toBe('json');
  });

```

Delete this test (currently lines 188-192) — it duplicates coverage already provided by the adjacent `'warns when --score is combined with --reporter'` test, which exercises the same `score && reporter-is-set` code path via `--reporter md`:

```ts
  it('warns when --score is combined with --json', () => {
    const { options, warnings } = resolve('--score', '--json');
    expect(options?.score).toBe(true);
    expect(warnings.some((w) => w.includes('--score overrides --reporter'))).toBe(true);
  });

```

- [ ] **Step 2: Replace the remaining `resolve('--json')` calls (used only as a convenience to get a non-null, resolved `options` object) with `resolve('--reporter', 'json')`**

In `packages/cli/test/resolve-args.test.ts`, there are 6 remaining call sites using `resolve('--json')` where the test doesn't care about the alias itself, only about getting valid resolved options. Replace each occurrence of:

```ts
    const { options } = resolve('--json');
```

with:

```ts
    const { options } = resolve('--reporter', 'json');
```

This appears in these tests (by their `it(...)` description, so you can find each one): `'omits diffBase/staged when not passed'`, `'leaves rules undefined when neither --rules nor --ignore is passed'`, `'omits weights when --weights is not passed'`, `'omits categories when --category is not passed'`, `'omits score when --score is not passed'`, `'sets explicitPath:false when no positional path is passed'`. All six have the exact same one-line body change — do all six.

- [ ] **Step 3: Remove `'json'` and `'fail-on-warning'` from the test file's local mri config**

In `packages/cli/test/resolve-args.test.ts`, change:

```ts
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score', 'verbose'],
```

to:

```ts
    boolean: ['by-route', 'staged', 'score', 'verbose'],
```

- [ ] **Step 4: Run the test file to verify the remaining/updated tests still pass with the OLD (pre-removal) `resolveArgs` implementation**

Run: `pnpm --filter svelte-vitals exec vitest run test/resolve-args.test.ts`
Expected: PASS (all tests green) — at this point `resolveArgs` still has the alias logic, and `--reporter json` already resolves `options?.reporter` to `'json'` today, so nothing should fail yet. This step just confirms the test-file edits themselves are correct in isolation before touching the implementation.

- [ ] **Step 5: Remove the alias logic from `resolve-args.ts`**

In `packages/cli/src/resolve-args.ts`, change:

```ts
  let reporter: ReporterName | undefined;
  if (argv.json) {
    reporter = 'json';
  } else if (typeof argv.reporter === 'string') {
```

to:

```ts
  let reporter: ReporterName | undefined;
  if (typeof argv.reporter === 'string') {
```

Change:

```ts
  const failOn = argv['fail-on-warning'] ? 'warning' : failOnValid ? failOnRaw : undefined;
```

to:

```ts
  const failOn = failOnValid ? failOnRaw : undefined;
```

Change:

```ts
  const score = Boolean(argv.score);
  if (score && (argv.json || typeof argv.reporter === 'string')) {
    warnings.push('svelte-vitals: --score overrides --reporter; reporter output suppressed.');
  }
```

to:

```ts
  const score = Boolean(argv.score);
  if (score && typeof argv.reporter === 'string') {
    warnings.push('svelte-vitals: --score overrides --reporter; reporter output suppressed.');
  }
```

- [ ] **Step 6: Update `bin.ts`'s help text and mri config**

In `packages/cli/src/bin.ts`, remove this line from `HELP` (it currently sits directly above `--fail-on <severity>`):

```
  --json                      Alias for --reporter=json
```

Remove this line from `HELP` (it currently sits directly below the `--fail-on` value table's closing, right before `--min-health`):

```
  --fail-on-warning           Alias for --fail-on=warning
```

Change:

```ts
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score', 'verbose'],
```

to:

```ts
    boolean: ['by-route', 'staged', 'score', 'verbose'],
```

- [ ] **Step 7: Run the test file again to verify it now passes against the updated implementation**

Run: `pnpm --filter svelte-vitals exec vitest run test/resolve-args.test.ts`
Expected: PASS, same test count as Step 4 minus the 3 deleted tests.

- [ ] **Step 8: Run the full CLI package test suite to catch anything Steps 1-6 missed**

Run: `pnpm --filter svelte-vitals test`
Expected: all test files pass. If any other test file (outside `resolve-args.test.ts`) references `--json` or `--fail-on-warning`, fix it the same way Step 2 did (swap to the real flag it was standing in for) and re-run.

- [ ] **Step 9: Update the English docs**

In `docs/src/content/docs/guides/cli.md`, delete this section (including its blank lines, currently right after the `--reporter` auto-selection paragraph and before `### --out-file <path>`):

```md
### `--json`

Alias for `--reporter=json`.

```

Delete this section (currently right after the `--fail-on` value table and its "Default behavior" line, before `### --min-health <0-100>`):

```md
### `--fail-on-warning`

Alias for `--fail-on=warning`.

```

Change:

```md
Combining `--score` with `--reporter`/`--json` is not an error, but the reporter output is suppressed and a warning is printed to stderr. The exit code is unaffected by `--score` — it still reflects `--fail-on` and `--min-health` as usual.
```

to:

```md
Combining `--score` with `--reporter` is not an error, but the reporter output is suppressed and a warning is printed to stderr. The exit code is unaffected by `--score` — it still reflects `--fail-on` and `--min-health` as usual.
```

In `docs/src/content/docs/guides/reporters.md`, change:

```md
```bash
svelte-vitals --reporter json
# or use the alias:
svelte-vitals --json
```
```

to:

```md
```bash
svelte-vitals --reporter json
```
```

Change:

```md
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on-warning
  # GITHUB_ACTIONS is already set; github reporter is auto-selected
```

to:

```md
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on warning
  # GITHUB_ACTIONS is already set; github reporter is auto-selected
```

- [ ] **Step 10: Update the Japanese docs**

In `docs/src/content/docs/ja/guides/cli.md`, delete this section (right after the `--reporter` auto-selection paragraph, before `### --out-file <path>`):

```md
### `--json`

`--reporter=json` のエイリアスです。

```

Delete this section (right after the `--fail-on` value table and its "デフォルト動作" line, before `### --min-health <0-100>`):

```md
### `--fail-on-warning`

`--fail-on=warning` のエイリアスです。

```

Change:

```md
`--score` を `--reporter`/`--json` と組み合わせてもエラーにはなりませんが、レポーター出力は抑制され、stderr に警告が表示されます。終了コードは `--score` の影響を受けず、`--fail-on` と `--min-health` を通常どおり反映します。
```

to:

```md
`--score` を `--reporter` と組み合わせてもエラーにはなりませんが、レポーター出力は抑制され、stderr に警告が表示されます。終了コードは `--score` の影響を受けず、`--fail-on` と `--min-health` を通常どおり反映します。
```

In `docs/src/content/docs/ja/guides/reporters.md`, change:

```md
```bash
svelte-vitals --reporter json
# またはエイリアスを使用：
svelte-vitals --json
```
```

to:

```md
```bash
svelte-vitals --reporter json
```
```

Change:

```md
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on-warning
  # GITHUB_ACTIONS はすでに設定済み；github レポーターが自動選択される
```

to:

```md
- name: Check SEO
  run: npx svelte-vitals@latest --fail-on warning
  # GITHUB_ACTIONS はすでに設定済み；github レポーターが自動選択される
```

- [ ] **Step 11: Grep for any remaining stray references**

Run: `grep -rn -- "--json\b\|--fail-on-warning\b" --include="*.md" --include="*.ts" . | grep -v node_modules | grep -v "/dist/" | grep -v "CHANGELOG.md" | grep -v "docs/superpowers/"`
Expected: no output. (`CHANGELOG.md` and `docs/superpowers/{plans,specs}/` are historical/generated, excluded per `AGENTS.md`.) If anything remains, fix it the same way as the matching case above.

- [ ] **Step 12: Verify the docs site builds**

Run: `pnpm --filter docs build`
Expected: build succeeds, no errors.

- [ ] **Step 13: Add the changeset**

Write `.changeset/remove-cli-aliases.md`:

```md
---
'svelte-vitals': minor
---

Remove the `--json` and `--fail-on-warning` CLI flags. Both were pure aliases for `--reporter=json` and `--fail-on=warning` respectively — use those instead. No deprecation period (pre-1.0).
```

- [ ] **Step 14: Typecheck, build, and commit**

Run: `pnpm --filter svelte-vitals typecheck && pnpm --filter svelte-vitals build`
Expected: no errors.

```bash
git add packages/cli/src/resolve-args.ts packages/cli/src/bin.ts packages/cli/test/resolve-args.test.ts \
  docs/src/content/docs/guides/cli.md docs/src/content/docs/ja/guides/cli.md \
  docs/src/content/docs/guides/reporters.md docs/src/content/docs/ja/guides/reporters.md \
  .changeset/remove-cli-aliases.md
git commit -m "feat(cli)!: remove the --json and --fail-on-warning alias flags

Both were pure aliases (--reporter=json / --fail-on=warning did the same
thing) with no independent behavior — removed pre-1.0 with no deprecation
period, per the v1.0 cleanup design."
```

---

### Task 2: Merge `rules/performance/` into `rules/perf/`

**Files:**
- Move: `packages/core/src/rules/performance/perf009-heavy-import.ts` → `packages/core/src/rules/perf/perf009-heavy-import.ts`
- Move: `packages/core/src/rules/performance/perf010-namespace-import.ts` → `packages/core/src/rules/perf/perf010-namespace-import.ts`
- Modify: `packages/core/src/rules/index.ts`
- Modify: `AGENTS.md`

**Interfaces:** None — `allRules`, every exported rule name (`perf009HeavyImport`, `perf010NamespaceImport`), and `packages/core/src/index.ts`'s re-export block are all unchanged. This task changes only where two files live on disk and the two import paths in `rules/index.ts` that point at them.

- [ ] **Step 1: Confirm the current (pre-move) core test suite is green, as a baseline**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: all tests pass. Note the test file count/pass count so Step 4 can confirm it's identical after the move (a behavior-preserving reorg should change zero test outcomes).

- [ ] **Step 2: Move the two files**

```bash
git mv packages/core/src/rules/performance/perf009-heavy-import.ts packages/core/src/rules/perf/perf009-heavy-import.ts
git mv packages/core/src/rules/performance/perf010-namespace-import.ts packages/core/src/rules/perf/perf010-namespace-import.ts
```

Confirm `packages/core/src/rules/performance/` is now empty and remove it (git already stops tracking it once both files are gone from it, but confirm no stray non-`.ts` file was left behind):

```bash
ls packages/core/src/rules/performance/ 2>&1
```

Expected: `ls: .../performance/: No such file or directory` (or an empty listing, if the shell doesn't auto-remove the empty dir — either way, nothing should remain to move or delete manually).

- [ ] **Step 3: Update the two import paths in `rules/index.ts`**

In `packages/core/src/rules/index.ts`, change:

```ts
import { perf009HeavyImport } from './performance/perf009-heavy-import.js';
import { perf010NamespaceImport } from './performance/perf010-namespace-import.js';
```

to:

```ts
import { perf009HeavyImport } from './perf/perf009-heavy-import.js';
import { perf010NamespaceImport } from './perf/perf010-namespace-import.js';
```

Do not change anything else in this file — `allRules`, the re-export block, and every other import stay exactly as they are.

- [ ] **Step 4: Run the core test suite again to confirm zero behavior change**

Run: `pnpm --filter @svelte-vitals/core test`
Expected: PASS, with the exact same test file count and test count as Step 1 — a reorg that changes test outcomes (pass→fail, or a different count) means something other than the import path broke; investigate before proceeding rather than assuming it's fine.

- [ ] **Step 5: Typecheck and build core**

Run: `pnpm --filter @svelte-vitals/core typecheck && pnpm --filter @svelte-vitals/core build`
Expected: no errors.

- [ ] **Step 6: Confirm no other package broke (core is a dependency of cli/vite/mcp)**

Run: `pnpm --filter svelte-vitals typecheck && pnpm --filter @svelte-vitals/vite typecheck && pnpm --filter @svelte-vitals/mcp typecheck`
Expected: no errors. These packages consume `@svelte-vitals/core`'s public exports (rule names, `allRules`), never its internal file paths, so this should be a no-op confirmation — but it's cheap insurance against an unexpected path leak.

- [ ] **Step 7: Update `AGENTS.md`**

In `AGENTS.md`, change:

```md
- **Adding a rule**: create `packages/core/src/rules/<category>/xxxNNN-slug.ts`, then register it in **four** places: `packages/core/src/rules/index.ts` (the import, the `allRules` array, and the re-export block) _and_ `packages/core/src/index.ts`'s own `export { ... } from './rules/index.js'` list, which duplicates the same names. TypeScript won't catch a missed spot in the fourth place (it's a plain re-export list), so grep for the previous rule's id after adding a new one. Add rule docs under `docs/src/content/docs/rules/<id>.md` (en) and `docs/src/content/docs/ja/rules/<id>.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build if either is missing. Note: for historical reasons performance rules are split across `rules/perf/` (PERF001–008) and `rules/performance/` (PERF009–010) — check both when looking for an existing PERF rule.
```

to:

```md
- **Adding a rule**: create `packages/core/src/rules/<category>/xxxNNN-slug.ts`, then register it in **four** places: `packages/core/src/rules/index.ts` (the import, the `allRules` array, and the re-export block) _and_ `packages/core/src/index.ts`'s own `export { ... } from './rules/index.js'` list, which duplicates the same names. TypeScript won't catch a missed spot in the fourth place (it's a plain re-export list), so grep for the previous rule's id after adding a new one. Add rule docs under `docs/src/content/docs/rules/<id>.md` (en) and `docs/src/content/docs/ja/rules/<id>.md` (ja) — `packages/cli/test/docs-links.test.ts` fails the build if either is missing.
```

(This is a one-sentence deletion at the end of the bullet — everything before "Note: for historical reasons…" is unchanged.)

- [ ] **Step 8: Grep for any remaining stray references to the old directory**

Run: `grep -rn "rules/performance\b" --include="*.ts" --include="*.md" . | grep -v node_modules | grep -v "/dist/" | grep -v "CHANGELOG.md" | grep -v "docs/superpowers/"`
Expected: no output.

- [ ] **Step 9: Commit**

No changeset for this task — pure internal reorg, no public API or behavior change (per the plan's Global Constraints).

```bash
git add packages/core/src/rules/perf/perf009-heavy-import.ts packages/core/src/rules/perf/perf010-namespace-import.ts \
  packages/core/src/rules/index.ts AGENTS.md
git status
```

Confirm `git status` shows `packages/core/src/rules/performance/perf009-heavy-import.ts` and `.../perf010-namespace-import.ts` as deleted (git tracks the `git mv` as a rename once both the delete and the add are staged together) — if `git status` shows them as untracked deletes instead of a detected rename, that's fine too (rename detection is a `git log`/`diff` display heuristic, not a correctness requirement); just make sure both old paths are gone and both new paths are present before committing.

```bash
git commit -m "refactor(core): merge rules/performance/ into rules/perf/

All PERF rules now live in one directory. No behavior change — same rule
ids, same allRules contents, same public exports; only the source files'
location and two import paths in rules/index.ts changed."
```

---

## Self-Review Notes

- **Spec coverage:** Decision 1 (remove aliases outright) → Task 1. Decision 2 (merge into `perf/`, not the reverse) → Task 2 Step 2. Decision 3 (directory-only, no file-granularity split) → Task 2's Global Constraints and the explicit "do not split images.ts/resource-hints.ts" note; no task attempts it. The spec's Components/Testing/Release sections map 1:1 onto each task's Files/Steps/changeset handling.
- **Placeholder scan:** no TBD/TODO; every step shows exact before/after code or exact shell commands.
- **Type consistency:** `reporter: ReporterName | undefined` and `failOn` in `resolve-args.ts` are untouched types, only the assignment logic changes — no signature changes anywhere in either task, so there's nothing to keep consistent across tasks (the two tasks don't share any interface).
