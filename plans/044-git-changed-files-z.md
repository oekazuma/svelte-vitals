# Plan 044: Read changed-file paths from git with `-z` so non-ASCII paths survive `--diff`/`--staged`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 9e0cf9e..HEAD -- packages/cli/src/changed-files.ts packages/cli/test/changed-files.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (`-z` output is unambiguous; the change is local to one module)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e0cf9e`, 2026-08-08

## Why this matters

With git's default `core.quotePath=true`, `git diff --name-only` returns any
path containing non-ASCII bytes (or quotes/backslashes) **octal-escaped and
wrapped in double quotes**. Verified empirically at commit `9e0cf9e`: a change
under `src/routes/ブログ/` comes back as

```
"src/routes/\343\203\226\343\203\255\343\202\260/+page.svelte"
```

while `Result.location` holds the raw UTF-8 path. `filterToChangedFiles`
compares the two with `Set.has`, so **every finding in such a file is silently
dropped from `--diff` and `--staged` runs** — the gate fails open on exactly
the files that changed, with no diagnostic. Japanese or accented route
directories are ordinary in SvelteKit projects (route directories map to URL
segments). `git ... -z` returns NUL-separated raw paths with no quoting, which
is the standard fix.

## Current state

The whole affected module, `packages/cli/src/changed-files.ts` (53 lines):

```ts
function git(args: string[], cwd: string): string[] {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
}

export function getChangedFiles(cwd: string, opts: ChangedFilesOptions): Set<string> | undefined {
  try {
    const files = opts.staged
      ? git(['diff', '--name-only', '--relative', '--cached', '--diff-filter=d'], cwd)
      : [
          ...git(['diff', '--name-only', '--relative', '--diff-filter=d', '--merge-base', opts.base ?? 'HEAD'], cwd),
          ...git(['ls-files', '--others', '--exclude-standard'], cwd) // untracked / new files
        ];
    return new Set(files.map((s) => s.trim()).filter(Boolean));
  } catch {
    return undefined;
  }
}

export function filterToChangedFiles(results: Result[], changed: Set<string>): Result[] {
  return results.filter((r) => r.location !== undefined && changed.has(r.location));
}
```

Facts the executor needs:

- The `git()` helper here is **module-local**. `packages/cli/src/baseline.ts`
  has its own separate `git()` helper — do NOT unify them; baseline's helper
  parses single-value output (`rev-parse`), not path lists.
- All three git invocations feed the same path set; all three need `-z`.
- `git diff --name-only -z` and `git ls-files --others -z` both emit
  NUL-terminated raw paths (trailing NUL at the end of output).
- The existing `.map((s) => s.trim())` exists to strip the `\n` artifacts;
  with NUL splitting, per-entry trimming must NOT be applied (a path may
  legitimately start/end with a space) — keep only `filter(Boolean)` to drop
  the empty trailing entry.
- Repo conventions: conventional commits (`fix(cli): ...`); user-facing changes
  need a changeset.

Existing test pattern to follow: `packages/cli/test/changed-files.test.ts`
builds a real temp git repo with `execFileSync` and commits with explicit
identity (`git -c user.name=... -c user.email=...`); model the new cases on the
cases already in that file.

## Commands you will need

| Purpose           | Command                                                                  | Expected on success |
| ----------------- | ------------------------------------------------------------------------ | ------------------- |
| Install           | `pnpm install`                                                           | exit 0              |
| Typecheck         | `pnpm -r typecheck`                                                      | exit 0              |
| CLI tests         | `pnpm --filter svelte-vitals test`                                       | all pass            |
| This file's tests | `pnpm --filter svelte-vitals exec vitest run test/changed-files.test.ts` | all pass            |
| Lint              | `pnpm lint`                                                              | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `packages/cli/src/changed-files.ts`
- `packages/cli/test/changed-files.test.ts`
- `.changeset/<new>.md`

**Out of scope** (do NOT touch, even though they look related):

- `packages/cli/src/baseline.ts` — its own `git()` helper serves single-value
  commands; unifying the helpers is churn with no benefit.
- `packages/cli/src/index.ts` — the `applyScope` wiring is correct; only the
  path decoding is wrong.

## Git workflow

- Branch: `advisor/044-git-changed-files-z`
- Commit style: `fix(cli): read changed-file paths NUL-separated so non-ASCII paths survive --diff/--staged`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Switch the helper to NUL-separated output

In `changed-files.ts`:

- Change `git()` to split on `'\0'` instead of `'\n'`.
- Add `-z` to all three invocations (`diff ... --cached`, `diff ... --merge-base`,
  `ls-files --others --exclude-standard`).
- Replace `.map((s) => s.trim()).filter(Boolean)` with `.filter(Boolean)`.
- Update the function's JSDoc: one sentence noting `-z` is required because
  default `core.quotePath` octal-escapes non-ASCII paths, which would never
  match `Result.location`.

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/changed-files.test.ts`
→ all existing tests pass unchanged (ASCII paths behave identically).

### Step 2: Regression tests

Add to `changed-files.test.ts`, following its existing temp-repo pattern:

1. **Non-ASCII tracked change**: commit `src/routes/ブログ/+page.svelte`, modify
   it, assert `getChangedFiles(cwd, {})` contains the literal string
   `'src/routes/ブログ/+page.svelte'`.
2. **Non-ASCII staged**: stage a change to the same file, assert the
   `{staged: true}` set contains the raw path.
3. **Non-ASCII untracked**: create `src/routes/café/+page.svelte` untracked,
   assert the `--diff` path (non-staged branch) includes it via `ls-files`.

If the CI filesystem can't represent these names the test would fail at file
creation, not in the assertion — that has not been a problem for this repo
(ubuntu-latest, APFS locally), but see STOP conditions.

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/changed-files.test.ts`
→ all pass including 3 new tests.

### Step 3: Changeset + format

- `pnpm changeset` → `svelte-vitals` **patch**: `--diff`/`--staged` no longer
  drop findings in files whose paths contain non-ASCII characters.
- `pnpm format`.

**Verify**: `pnpm lint` → exit 0; `pnpm test` → all pass.

## Test plan

Covered in Step 2. Pattern file: `packages/cli/test/changed-files.test.ts`
(real git in a temp dir, explicit commit identity). The three new cases cover
the three git invocations (diff, diff --cached, ls-files).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm -r typecheck` exits 0
- [ ] `pnpm test` exits 0; 3 new tests exist and pass
- [ ] `grep -n "split('\\\\n')" packages/cli/src/changed-files.ts` returns no matches
- [ ] `grep -n "'-z'" packages/cli/src/changed-files.ts` returns ≥ 1 match (tripwire only — the real gate is the 3 new tests, which prove all three invocations decode NUL-separated output)
- [ ] A changeset file exists for `svelte-vitals` (patch)
- [ ] `pnpm lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `changed-files.ts` excerpt doesn't match the live code (drift).
- A new test fails because the host filesystem rejects the non-ASCII filename
  itself (report the platform; do not silently switch to ASCII fixtures —
  the non-ASCII path IS the regression under test).
- Any existing test asserts on the quoted/escaped path form (would mean
  something depends on the broken behavior).

## Maintenance notes

- Any future call site that shells out to git for **path lists** must use `-z`
  (or `-c core.quotePath=off`); a reviewer should check for this whenever a new
  `git diff`/`ls-files` invocation appears in `packages/cli`.
- `filterToChangedFiles` still compares exact strings. If `Result.location`
  ever changes its path basis (see the JSDoc in `changed-files.ts` about
  `--relative` and monorepo subdirectories), these tests are the canary.
