# A large report must survive the exit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `svelte-vitals --reporter json` from losing everything past the first 65,536 bytes when its
output is piped.

**Architecture:** `bin.ts` writes the report and then calls `process.exit(code)`, which discards whatever has
not drained to the pipe. One awaited empty write flushes the stream first. A new smoke check routes the report
through a real pipe so the regression is catchable in CI, where the existing check's channel is too wide to
catch it.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), `node:assert`-based smoke script (no test runner),
vitest for the package suites, oxlint + oxfmt.

**Spec:** `docs/superpowers/specs/2026-08-04-stdout-truncation-on-exit-design.md`. Read it before Task 1. It
was rejected three times by adversarial review — twice for a diagnosis that was backwards, once for
prescribing a check that could not fail — so treat its stated mechanisms as measured, not as guesses.

## Global Constraints

- **`scripts/floor-smoke.mjs` must stay Node-builtins-only.** `AGENTS.md`: "never add a dev dependency to the
  smoke". `sh` and `cat` are the OS, not dependencies, and are the only external programs this plan adds.
- **The new pipe check asserts payload integrity only.** The CLI's 0/1/2 exit contract cannot survive a
  pipeline — measured, the CLI exits 1 while `sh` reports 0 — and `/bin/sh` on `ubuntu-latest` is `dash`,
  which has no `set -o pipefail` (added in dash 0.5.13; Ubuntu ships 0.5.12). Exit-code fidelity stays with
  the existing `execFileSync` checks.
- **Do not interpolate paths into a shell string.** Use `sh -c '…' sh "$@"` positional parameters, or a
  checkout inside a directory with a space in its name breaks the check.
- **Only the analysis path changes.** `install` (`bin.ts:103`), `ci` (`:107`) and the two argument-validation
  exits (`:148`, `:156`) are out of scope: measured output is 1,377 bytes for `install --dry-run` and 85 for
  `ci`, two orders of magnitude under any buffer.
- **`docs` and `explain` are already safe** — they set `process.exitCode` and return — and are not touched.
- **Comments and docs are for the next reader** (`AGENTS.md`): a line earns its place only when it says
  something the code cannot. Prefer one line over three.
- **Never name another tool, linter, plugin or product** in any comment, doc or commit message.
- Conventional commits, scoped by package. **A changeset is required** — this is a user-visible fix, so
  `patch`, listing `svelte-vitals` only (nothing in `core` or `vite` changes).

## File Structure

| File                                      | Responsibility                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `scripts/floor-smoke.mjs`                 | add one check that runs the report through a real pipe and parses it. The existing checks and helpers are untouched. |
| `packages/cli/src/bin.ts`                 | flush stdout before the analysis path's `process.exit`. One statement.                                               |
| `.changeset/stdout-truncation-on-exit.md` | **new**                                                                                                              |

Two tasks, in this order, because **the order is the experiment**: the check lands first and is pushed so CI
runs it against the unfixed CLI. That is what turns "a Linux shell pipe truncates too" from an expectation
into a measurement. Reversing the order destroys the evidence — a check added beside its own fix can only ever
be seen passing.

---

## Task 1: A smoke check that routes the report through a real pipe

**Files:**

- Modify: `scripts/floor-smoke.mjs` (add a `check(...)` block after the existing
  `the read-only subcommands deliver complete JSON through a pipe`, around line 103)

**Interfaces:**

- Consumes, all already in scope in that file: `execFileSync` (imported from `node:child_process`), `assert`
  (`node:assert`, strict), `check(name, fn)`, `cliBin`, `basicProject`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Read the two checks this one sits between**

Read `scripts/floor-smoke.mjs` from the top through the `a bad subcommand argument exits 2` check. Note the
house style: `check('lowercase sentence describing the behaviour', () => { … })`, hand-rolled
`assert` with a message naming what went wrong, and `runCli` for anything that needs the exit code.

**This check does not use `runCli`** — `runCli` spawns the CLI directly, which is the socketpair channel the
new check exists to avoid. It calls `execFileSync('sh', …)` itself.

- [ ] **Step 2: Add the check**

Insert after the `the read-only subcommands deliver complete JSON through a pipe` check:

```js
check('the analysis report survives a real shell pipe', () => {
  // `runCli` and the sibling checks give the child a socketpair, whose buffer is wide enough on Linux to
  // hide a truncation; `sh -c '… | cat'` gives it a 65,536-byte FIFO, which is what a user piping to `jq`
  // gets. Positional parameters rather than interpolation, so a checkout path containing a space survives.
  // Payload integrity only: a pipeline's exit status is `cat`'s, so the CLI's 0/1/2 contract is unassertable
  // here and stays with the checks above.
  const stdout = execFileSync(
    'sh',
    ['-c', '"$1" "$2" "$3" --reporter json | cat', 'sh', process.execPath, cliBin, basicProject],
    {
      encoding: 'utf8',
      // stderr inherited, not ignored: a clean `--reporter json` run writes nothing there, and when the
      // fixture is broken the CLI's own reason beats a JSON parse error as the thing the smoke prints.
      stdio: ['ignore', 'pipe', 'inherit']
    }
  );
  const report = JSON.parse(stdout);
  assert.equal(typeof report.version, 'string');
  assert.equal(typeof report.score, 'number');
});
```

- [ ] **Step 3: Run the smoke and confirm the new check FAILS**

```bash
pnpm --filter svelte-vitals build   # dist must exist; the smoke never builds for you
pnpm smoke
```

Expected on macOS: **2 of 8 checks fail** — the new one and the pre-existing
`analysing a real project emits a well-formed JSON report` — both with
`SyntaxError: Unterminated string in JSON at position 65488`.

**If the new check passes here, stop and report it.** Either `dist` is stale, or the fixture's report has
shrunk below 65,536 bytes and the check can no longer detect anything. Verify the size before doing anything
else:

```bash
cd packages/cli/test/fixtures/basic-project && node ../../../dist/bin.js --reporter json | wc -c
```

67,656 is the expected figure. A number at or below 65,536 means the fixture, not the check, needs attention —
report it rather than adjusting the check.

- [ ] **Step 4: Confirm nothing else regressed**

```bash
(cd packages/cli && ../../node_modules/.bin/vitest run)
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: 805 tests pass, lint and format clean. The smoke is not part of the vitest suites, so its two
failures do not appear here.

- [ ] **Step 5: Commit**

```bash
git add scripts/floor-smoke.mjs
git commit -m "test: catch a truncated report through a real shell pipe"
```

- [ ] **Step 6: Push and read CI — this is the measurement, not a formality**

Push the branch and open (or update) its pull request. Wait for `test (22)`, `test (24.16.0)`, `test (26)` and
`floor-smoke` — four runs of the smoke on `ubuntu-latest`.

Record which of the two outcomes happened, with the job names and the failure text:

- **Any of the four fails on the new check** — Linux truncation confirmed, the check is proven to catch it,
  Task 2 turns it green. This is the expected outcome.
- **All four pass** — Linux's pipe did not truncate on this run. **Do not conclude the check is useless**:
  truncation is a race the writer usually but not always wins (12 of 12 locally, and the design's reviewer saw
  1 run in 15 deliver the whole payload). Report all-green as an observation and continue to Task 2; the check
  still guards the macOS path and costs nothing.

Either way, **report the CI result in your task report.** It is the evidence the spec's Testing section
mandates, and Task 2's reviewer needs it.

---

## Task 2: Flush stdout before the analysis path exits

**Files:**

- Modify: `packages/cli/src/bin.ts:166` (the `process.exit(code)` at the end of `main()`)
- Create: `.changeset/stdout-truncation-on-exit.md`

**Interfaces:**

- Consumes: the smoke check added in Task 1.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Confirm the check still fails before you change anything**

```bash
pnpm smoke
```

Expected: the same two failures Task 1 ended with. If the smoke is green, `dist` was rebuilt from a tree that
already has the fix — stop and check `git log`.

- [ ] **Step 2: Add the flush**

In `packages/cli/src/bin.ts`, the end of `main()` currently reads:

```ts
  const code = await run({
    ...options,
    minHealth,
    selectApp
  });
  process.exit(code);
}
```

Change the last two lines to:

```ts
  // A write to a pipe is asynchronous, so `process.exit` can discard what has not drained — the report is
  // the largest thing this CLI writes and the first pipe buffer is 65,536 bytes. The empty write's callback
  // fires once the stream has flushed. `process.exit` rather than `process.exitCode` because this path can
  // hold an interactive prompt, where returning could hang instead.
  await new Promise((resolve) => process.stdout.write('', resolve));
  process.exit(code);
}
```

Do not change anything else in the file. Do not touch the `install`, `ci` or argument-validation exits.

- [ ] **Step 3: Rebuild and confirm the smoke is fully green**

```bash
pnpm --filter svelte-vitals build
pnpm smoke
```

Expected: **8 of 8 checks pass.** Both the new pipe check and the pre-existing
`analysing a real project emits a well-formed JSON report` now pass.

- [ ] **Step 4: Confirm the payload and the exit codes by hand**

The smoke covers integrity; these four commands cover the exit contract, which the pipe check deliberately
cannot assert:

```bash
BIN="$(pwd)/packages/cli/dist/bin.js"   # run this from the repo root
(cd packages/cli/test/fixtures/basic-project && node "$BIN" --reporter json | wc -c)          # expect 67656
(cd packages/cli/test/fixtures/basic-project && node "$BIN" --reporter json >/dev/null; echo $?)  # expect 1
(cd "$TMPDIR" && node "$BIN" >/dev/null 2>&1; echo $?)                                        # expect 2
```

Record all three actual values in your report. A wrong exit code here is a regression the smoke would not
catch on the piped path.

- [ ] **Step 5: Prove the fix is load-bearing**

Revert the `await new Promise(...)` line, rebuild, run `pnpm smoke`, and confirm the two checks fail again.
Restore it, rebuild, confirm 8 of 8. Report both results. A fix whose removal leaves the smoke green is not
the fix.

- [ ] **Step 6: Run the package suites and typecheck**

```bash
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/vitest run); done
(cd packages/core && ../../node_modules/.bin/tsup)
for p in core cli vite; do (cd packages/$p && ../../node_modules/.bin/tsc --noEmit); done
node_modules/.bin/oxlint . && node_modules/.bin/oxfmt --check .
```

Expected: all green. (`packages/mcp` has no `tsconfig.json`; skip it.)

- [ ] **Step 7: Write the changeset**

Create `.changeset/stdout-truncation-on-exit.md`:

```md
---
'svelte-vitals': patch
---

A large report is no longer truncated when the CLI's output is piped.

`svelte-vitals --reporter json` writes the report and then exits, and a write to a pipe is asynchronous — so
anything past the first buffer, 65,536 bytes on Linux and macOS, was discarded. The exit code was unaffected,
so a consumer saw a successful run and a payload cut mid-string. Any project whose report exceeds that size
was affected, and `--reporter html` written to stdout the same way.

The CLI now waits for stdout to drain before exiting. Piping to `jq`, to a file through a shell, or into
another process delivers the whole report.
```

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/bin.ts .changeset/stdout-truncation-on-exit.md
git commit -m "fix(cli): flush stdout before exiting so a piped report is not truncated"
```

- [ ] **Step 9: Push and confirm CI is green**

Push and wait for all seven jobs. The new pipe check must pass on all four smoke runs. If it fails on Linux
now, the flush is not sufficient there and that is a finding to report rather than to work around.

---

## Notes for whoever runs this

- A full-workspace `pnpm` command fails in this sandbox for a known, pre-existing reason (the `docs`
  package's dependencies). `pnpm smoke` and `pnpm --filter svelte-vitals build` both work.
- **`pnpm smoke` does not build.** It exits 1 with a message if `packages/cli/dist/bin.js` is missing. Every
  smoke run in this plan assumes you built first; a stale `dist` is the most likely reason a step's expected
  result does not appear.
- The spec records three things as deliberately out of scope, so do not implement them: `install`/`ci`, a
  general flush helper, and the separate `--out-file -` bug (its space-separated form silently writes
  `svelte-vitals-report.html` to the cwd because `mri` parses a lone `-` as `""`; `--out-file=-` works).
- The design's rejected alternative was `process.exitCode = code; return;`. It measured identically. It was
  rejected because the analysis path can hold an interactive prompt and the failure mode of being wrong is a
  CLI that never returns. Do not "simplify" the flush into it.
