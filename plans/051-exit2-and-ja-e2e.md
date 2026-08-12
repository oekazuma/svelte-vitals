# Plan 051: Preserve exit code 2 on internal crashes, and pin the ja `--help` path through the real binary

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat ddcf62d0..HEAD -- packages/cli/src/bin.ts packages/cli/src/cli.ts scripts/cli-e2e.mjs packages/cli/test/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — the catch only fires on paths that today crash with a raw
  stack trace; the e2e additions are additive checks.
- **Depends on**: none
- **Category**: bug + tests
- **Planned at**: commit `ddcf62d0`, 2026-08-12

## Why this matters

Two independent audit passes found the same pair of process-boundary gaps:

1. **Exit-code inversion on crashes.** The CLI's contract is `0` = clean,
   `1` = failing finding, `2` = execution error; the root `--help` even
   tells agents "Exit 2 is never a pass — it means the analysis did not
   run." But `bin.ts` runs `void main()` with no catch and nothing handles
   unhandled rejections, so any throw that escapes the dispatch layer
   (gunshi's `cli()`, a help-text `generate()`, the dynamic
   `import('@gunshi/plugin-i18n')` on the ja branch, the documented
   `@bomb.sh/tab` assert hazard in `complete.ts:112-127`) terminates Node
   with **exit 1** and a raw stack trace — a CI gate reads "a rule failed"
   for what is actually a crash. The gunshi migration widened this throw
   surface.
2. **The ja feature has zero real-process coverage.** Every ja test injects
   `env` in-process; `scripts/cli-e2e.mjs` and `floor-smoke.mjs` never set
   `LANG`/`LC_ALL`/`SVELTE_VITALS_LANG` (verified by grep). The ja branch
   alone crosses two dynamic imports and a bundler-produced locale chunk, so
   a packaging/env-plumbing regression would revert every real
   `LANG=ja_JP.UTF-8` user to English (or crash) while all goldens stay
   green.

## Current state

- `packages/cli/src/bin.ts` (entire file):

  ```ts
  #!/usr/bin/env node
  import { runCli } from './cli.js';

  /** Thin entry point: `runCli` does the full dispatch and never exits the process itself — see `CliResult.exit` for why the two mechanics below still have to differ per path. */
  async function main(): Promise<void> {
    const { code, exit } = await runCli(process.argv.slice(2));
    if (exit === 'immediate') {
      process.exit(code);
    } else {
      process.exitCode = code;
    }
  }

  void main();
  ```

- `packages/cli/src/cli.ts:32-69` — `runCli(argv, env = process.env)`
  dispatches on `argv[0]` to dynamic-imported sub-command runners and to the
  static analyze runner; it returns `CliResult { code, exit }` and has no
  outer try/catch.
- Exit-code contract prose: `packages/cli/src/gunshi/analyze.ts:196-199`
  and `:213`.
- `scripts/cli-e2e.mjs` — 10 checks against the built `dist/bin.js` via
  `spawnSync`; child env is built by `cleanEnv()` from
  `CHILD_ENV_ALLOWLIST` (`cli-e2e.mjs:59-67`); checks are registered in a
  `checks` array and run in a loop (`:246-254`). Fails fast with "run
  `pnpm build` first" when dist is missing (`:21-28`).
- Real anchors measured at `ddcf62d0` (use these, do not invent):
  - `LANG=ja_JP.UTF-8 node packages/cli/dist/bin.js --help` → line 1 starts
    `svelte-vitals — 決定論的な SvelteKit コードヘルスチェッカー`, line 3 is
    `使用方法:`.
  - Clean env `--help` → line 1 starts
    `svelte-vitals — a deterministic SvelteKit code-health scanner`.
- ja env precedence (from `packages/cli/src/gunshi/locale.ts`):
  `SVELTE_VITALS_LANG` beats `LC_ALL` beats `LANG`; value must canonicalize
  to `ja`.

## Commands you will need

| Purpose    | Command          | Expected on success |
|------------|------------------|---------------------|
| Install    | `pnpm install`   | exit 0              |
| Build      | `pnpm build`     | exit 0              |
| Typecheck  | `pnpm typecheck` | exit 0              |
| Tests      | `pnpm test`      | all pass            |
| E2E        | `pnpm e2e`       | all checks ok, exit 0 (needs `pnpm build` first) |
| Lint       | `pnpm lint`      | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `packages/cli/src/cli.ts` — outer try/catch in `runCli`
- `packages/cli/src/bin.ts` — last-resort `.catch`
- `scripts/cli-e2e.mjs` — new checks
- `packages/cli/test/` — one new vitest file (or extend an existing
  `runCli`-level test)
- `.changeset/<new>.md` (create)

**Out of scope** (do NOT touch, even though they look related):
- `scripts/floor-smoke.mjs` — deliberately Node-builtins-only and
  floor-scoped; the e2e is the right home (see the header of
  `cli-e2e.mjs:5-7`).
- `packages/cli/src/gunshi/**` — no changes to the dispatchers; the catch
  lives above them.
- The exit-code contract itself (0/1/2 semantics) — unchanged.

## Git workflow

- Branch: `advisor/051-exit2-and-ja-e2e`
- Conventional commits, e.g. `fix(cli): map internal dispatch crashes to
  exit 2 instead of an unhandled rejection` and `test(cli): pin the ja
  --help path through the built binary`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Catch dispatch-layer throws in `runCli`

Wrap the body of `runCli` (in `packages/cli/src/cli.ts`) in try/catch. On
catch: print `svelte-vitals: <err.message or String(err)>` to stderr via
`console.error` and return `{ code: 2, exit: 'natural' }` (natural, so
streams flush). Keep the existing body unchanged inside the try.

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Last-resort catch in `bin.ts`

Change `void main();` to:

```ts
main().catch((err: unknown) => {
  console.error(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
});
```

(This should now be unreachable — Step 1 catches everything inside `runCli`
— but it is the guarantee the contract prose makes.)

**Verify**: `pnpm typecheck` → exit 0.

### Step 3: Unit-test the catch

New vitest file in `packages/cli/test/` (e.g. `cli-crash-exit.test.ts`):
use `vi.mock('../src/gunshi/analyze.js', …)` to make `runAnalyzeCliGunshi`
throw, call `runCli(['some-path'])`, assert the result is
`{ code: 2, exit: 'natural' }` and that the captured `console.error` line
starts with `svelte-vitals: ` and contains no newline-separated stack frames.
Model the mocking style on existing tests that mock modules (search
`packages/cli/test` for `vi.mock(` and follow the closest precedent).

**Verify**: `pnpm --filter svelte-vitals exec vitest run test/cli-crash-exit.test.ts`
→ passes.

### Step 4: Add the ja checks to `cli-e2e.mjs`

Register two new checks in the existing `checks` array, following the shape
of the existing reporter-auto-detection checks (which already use
`cleanEnv()` overrides):

1. `--help` with `cleanEnv({ LANG: 'ja_JP.UTF-8' })` → exit 0, stdout
   contains `使用方法:` (and, to catch partial rendering, also
   `決定論的な SvelteKit`).
2. `--help` with plain `cleanEnv()` → exit 0, stdout contains
   `a deterministic SvelteKit code-health scanner` and does NOT contain
   `使用方法:` — pins the plumbing in both directions.

Note: `LANG` must survive `cleanEnv` — check `CHILD_ENV_ALLOWLIST`; if
`LANG` is not allowlisted, pass it as an explicit override the way the
agent-detection checks pass `CLAUDECODE=1` (do not widen the allowlist for
all checks).

**Verify**: `pnpm build && pnpm e2e` → all checks ok (now 12+), exit 0.

### Step 5: Changeset

Run `pnpm changeset`: `svelte-vitals` **patch**. Suggested wording: "An
internal crash in the CLI's dispatch layer now exits 2 with a one-line
`svelte-vitals:` diagnostic instead of exit 1 with a raw stack trace —
exit 1 keeps meaning 'a finding failed the gate'."

**Verify**: a new `.changeset/*.md` names `svelte-vitals: patch`.

## Test plan

- Step 3's vitest: forced dispatch throw → `{ code: 2, exit: 'natural' }`,
  single-line diagnostic.
- Step 4's e2e: ja and en `--help` through the real binary and real env.
- Regression net: full `pnpm test` and `pnpm e2e`; the existing exit-code
  checks 1-5 in `cli-e2e.mjs` must stay green (proves the try/catch didn't
  change any reachable path).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm build && pnpm typecheck && pnpm test && pnpm lint` all exit 0
- [ ] `pnpm e2e` exits 0 and its output lists the two new ja/en help checks
- [ ] `grep -c 'catch' packages/cli/src/bin.ts` ≥ 1 and
      `grep -c 'code: 2' packages/cli/src/cli.ts` ≥ 1
- [ ] New vitest crash test passes
- [ ] Changeset file exists (`svelte-vitals: patch`)
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `bin.ts` no longer matches the excerpt (someone added a catch already).
- Wrapping `runCli` changes any existing test's observed exit code — a
  currently-reachable path was throwing and being interpreted differently;
  that's a behavior question for the maintainer, not something to paper
  over.
- The ja e2e check fails against the freshly built dist — that is a REAL
  packaging bug (exactly what this plan exists to detect); report it as a
  finding instead of weakening the assertion.
- `vi.mock` of the analyze module proves impossible due to the static
  import in `cli.ts` — report which mocking approaches you tried.

## Maintenance notes

- Anyone adding a new sub-command gets crash-to-exit-2 for free (the catch
  is above the dispatch). The contract prose in `analyze.ts:196-213` now
  matches reality.
- If the ja anchors (`使用方法:` etc.) are ever reworded in
  `locales/ja.ts`, the e2e check needs the same edit — cheap, and the
  failure message makes it obvious.
- Deferred: a deterministic e2e that forces a crash through the real binary
  (no clean mechanism exists without adding a test hook to prod code); the
  in-process mock in Step 3 covers the logic, the e2e covers the plumbing.
