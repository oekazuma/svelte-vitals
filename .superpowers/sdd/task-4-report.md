# Task 4 Report: CLI `--reporter html` + `--out-file`

## Files Changed

| File | Change |
|------|--------|
| `packages/cli/src/reporter-resolve.ts` | Added `'html'` to `ReporterName` union type; expanded `isReporterName` to include `value === 'html'` |
| `packages/cli/src/resolve-args.ts` | Updated unknown-reporter error message to include `html`; added `outFile` field from `argv['out-file']` |
| `packages/cli/src/index.ts` | Added `import { writeFileSync } from 'node:fs'`; added `formatHtmlReport` to core import; added `outFile?`/`writeFile?` to `RunOptions`; inserted `html` branch before the final console `else` |
| `packages/cli/src/bin.ts` | Updated `--reporter` HELP line to include `html`; added `--out-file` HELP line; added `'out-file'` to mri `string` array |
| `packages/cli/test/html-reporter.test.ts` | New test file (4 test cases verbatim from brief) |
| `packages/core/src/reporter/html.ts` | **Deviation (see below):** fixed TypeScript strict-null error on lines 42–43 |

## Deviation: core/src/reporter/html.ts fix

The brief says Tasks 1–3 are done. However, the core package had a pre-existing TypeScript DTS build error in `html.ts` that prevented `pnpm build` from succeeding, meaning `formatHtmlReport` was missing from `packages/core/dist/index.js`. The fix was minimal: `escapeHtml(issue.location)` → `escapeHtml(issue.location ?? '')` and same for `issue.recommendation`. Both fields are typed as `string | undefined` in `Result` but `escapeHtml` expects `string`. This was the root cause of 3 failing tests after Step 3 was applied.

## Test Commands and Results

### html-only suite
```
cd packages/cli && pnpm vitest run test/html-reporter.test.ts
```
**4 passed (4)** — 1 test file

### Full CLI suite
```
cd packages/cli && pnpm vitest run
```
**122 passed (122)** — 16 test files

## Commit

Commit hash: `86826ee`
Message: `feat(cli): add --reporter html with --out-file`

## Fix: Typecheck-clean under strict mode (commit `3001af5`)

### Problem

`pnpm -r typecheck` (tsc --noEmit) failed on three lines in `packages/cli/test/html-reporter.test.ts`:

```
packages/cli/test/html-reporter.test.ts(27,12): error TS2532: Object is possibly 'undefined'.
packages/cli/test/html-reporter.test.ts(28,12): error TS2532: Object is possibly 'undefined'.
packages/cli/test/html-reporter.test.ts(35,12): error TS2532: Object is possibly 'undefined'.
```

TypeScript's strict mode flags `writes[0]` as possibly `undefined` even though the preceding `expect(writes).toHaveLength(1)` guarantees presence at runtime. vitest does not typecheck, so these passed under `pnpm vitest run` but failed under `tsc --noEmit`.

### Fix

Applied non-null assertions (`!`) to the three array accesses in `packages/cli/test/html-reporter.test.ts`:

- Line 27: `writes[0][0]` → `writes[0]![0]`
- Line 28: `writes[0][1]` → `writes[0]![1]`
- Line 35: `writes[0][0]` → `writes[0]![0]`

All assertions and their meaning are preserved.

### Commands Run and Output

```
CI=true pnpm -r typecheck
```
```
packages/core typecheck: Done
packages/cli typecheck: Done
packages/vite typecheck: Done
packages/mcp typecheck: Done
```
All packages green, exit 0.

```
cd packages/cli && pnpm vitest run test/html-reporter.test.ts
```
```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Commit

Commit hash: `3001af5`
Message: `test(cli): make html-reporter test typecheck-clean under strict mode`

## Concerns

- The TypeScript strict-null fix in `packages/core/src/reporter/html.ts` is outside Task 4's scope (Tasks 1–3 were supposed to be done). It is a correctness fix with zero behavioral change at runtime. Should be noted for the Task 1–3 author.
- The core dist is `.gitignore`d and not committed; CI must rebuild core before running CLI tests. This is consistent with the existing repo setup.

---

## Post-Review Fix: M-1 + M-2 (commit dad1b96)

Applied two minor findings from the Task 4 review.

### Changes made

- **M-2** (`packages/cli/test/html-reporter.test.ts` line 1): Removed unused `vi` import → `import { describe, it, expect } from 'vitest';`
- **M-1** (`packages/core/src/reporter/html.ts` lines 50–51): Changed `renderFinding` to conditionally omit `<p class="f-loc">` and `<p class="f-rec">` when `issue.location` / `issue.recommendation` are absent, instead of rendering empty paragraphs.
- Also ran `prettier --write` on 3 pre-existing Prettier violations (`docs/superpowers/plans/2026-06-23-visual-html-report.md`, `packages/cli/src/bin.ts`, `packages/core/test/html-report.test.ts`) that were blocking `pnpm lint`.

### Verification

```
$ CI=true pnpm -r typecheck
packages/core typecheck: Done
packages/cli typecheck: Done
packages/vite typecheck: Done
packages/mcp typecheck: Done
# → all packages pass

$ cd packages/core && pnpm vitest run test/html-report.test.ts
Test Files  1 passed (1)
Tests  11 passed (11)
# → 11/11 pass

$ cd packages/cli && pnpm vitest run test/html-reporter.test.ts
Test Files  1 passed (1)
Tests  4 passed (4)
# → 4/4 pass

$ pnpm lint
prettier --check . && eslint .
All matched files use Prettier code style!
# → passes (no eslint errors)
```
