# A large report must survive the exit — design

**Date:** 2026-08-04
**Status:** approved
**Origin:** found by the whole-branch review of `feat/score-proportionality` (PR #363), which hit it as a
`pnpm smoke` failure. `packages/cli/src/bin.ts` already recorded it as a deferral.

## The problem

`svelte-vitals --reporter json` piped to another process emits **exactly 65,536 bytes** — one pipe buffer —
and stops mid-string. The report is 67,656 bytes. Measured on the repo's own
`packages/cli/test/fixtures/basic-project`:

```
$ node dist/bin.js --reporter json | wc -c
   65536
$ node dist/bin.js --reporter json | tail -c 40
src/routes/+layout.svelte",
          "r
```

`bin.ts` writes the report through `console.log` and then calls `process.exit(code)`. A write to a pipe is
not guaranteed to have drained when `process.exit` runs, so whatever is still buffered is discarded. This is
silent: the exit code is still 1, so a consumer sees a successful run and a truncated payload.

The file already knows. `bin.ts` line 84 onward:

> `docs` and `explain` set `process.exitCode` and return rather than calling `process.exit`: writes to a pipe
> are asynchronous, and exiting can discard whatever has not drained. … (`install`/`ci` and the analysis path
> below still exit directly — they hold prompts and timers, where returning could hang instead; **their
> large-output paths deserve the same treatment separately.**)

This is that separately. `--reporter json` is the largest thing the CLI writes, it is the channel CI and
agents use, and the release immediately before this one changed every score in it — so it is also the payload
people are about to re-read.

## Why CI never caught it

Node's `process.stdout` is synchronous for pipes on Linux and Windows, and **asynchronous for pipes on
macOS**. Every CI job runs on Linux, where the write completes before `process.exit` can drop it. The bug is
real on macOS and on any platform where the write does not complete synchronously.

That has a consequence for this design: **the fix cannot be defended by CI.** It is stated here rather than
papered over — see Testing.

## Design

Flush before exiting, in `bin.ts`'s analysis path:

```ts
await new Promise((resolve) => process.stdout.write('', resolve));
process.exit(code);
```

The empty write's callback fires once the stream has drained to the OS, so nothing is buffered when
`process.exit` runs. Measured with this in place: **67,656 bytes, valid JSON, exit 1** — and exit 2 still on a
directory that is not a SvelteKit project.

### Why not `process.exitCode` and return, like `docs` and `explain`

That was the first candidate, and it works: measured at 67,656 bytes, valid JSON, terminating on its own with
exit 1, and exit 2 for a non-project. It is also the more uniform answer, since it would make every path in
`bin.ts` exit the same way.

**It is rejected because it works for a reason this design cannot verify.** Returning only terminates if
nothing is holding the event loop, and the analysis path can run the monorepo app picker — an interactive
prompt over stdin. It happens not to matter for the reported bug: the help text promises "Analysis never
prompts when stdout is not a TTY", so the prompt cannot be open in the piped case, and the score animation is
likewise TTY-only. So the measurement above is sound for the case that truncates.

But the failure mode of being wrong is a CLI that never returns, which is worse than the truncation it
replaces, and the interactive path cannot be exercised in an automated check. The comment in `bin.ts` names
prompts and timers as the reason those paths exit directly; this design declines to bet against its own
codebase's stated constraint for a uniformity gain.

Flushing gets the same measured result and changes nothing about termination.

### Scope

**Only the analysis path.** `install` and `ci` also call `process.exit`, and the same hazard applies to them
in principle, but neither writes anything close to a pipe buffer — `install` prints a plan, `ci` prints a
scaffold summary. Adding the flush there would be speculative; adding it when one of them grows a large
output is the same one-line change. Recorded, not done.

`docs` and `explain` are already safe and are not touched.

## Testing

**The regression test already exists and already fails.** `scripts/floor-smoke.mjs` has
`analysing a real project emits a well-formed JSON report`, which runs the built CLI through
`execFileSync` — a pipe, not a TTY — and `JSON.parse`s the whole payload. On macOS today it fails with
`SyntaxError: Unterminated string in JSON at position 65488`. The fix makes it pass. No new test is needed
for the symptom, and writing one would duplicate a check whose sibling comment already names this exact
mechanism:

> `execFileSync` gives the child a pipe, not a TTY — the case where `process.exit` can drop undrained writes.
> Parsing the whole payload is what proves nothing was truncated.

That sibling — `the read-only subcommands deliver complete JSON through a pipe` — covers `docs` and
`explain`, the two paths that already return instead of exiting. The analysis path is the gap it was written
beside.

**What no test can do here.** On Linux the check passes with or without the fix, so CI cannot catch a
regression. `pnpm smoke` on a macOS developer machine is the only gate, and `AGENTS.md` already positions the
smoke as the thing run locally after a build. Two things follow, and both are deliberate:

- the smoke assertion is kept as the regression test even though CI cannot fail on it, because the
  alternative — a test that fabricates the async condition — would assert an implementation detail rather
  than the behaviour;
- the fixture must stay large enough to exceed a pipe buffer. It is 67,656 bytes today, 3% above 65,536.
  A fixture that shrank below the buffer would make the check pass everywhere for the wrong reason. Worth
  knowing, not worth pinning with an assertion on a byte count that would then need maintaining.

## Deliberately not solved

- **`install` and `ci`.** See Scope.
- **A general "flush before every exit" helper.** One call site does not justify an abstraction, and the
  three other `process.exit` sites in `bin.ts` are argument-validation failures that write a single line to
  stderr.
- **The `pnpm smoke` / CI asymmetry.** That the smoke can fail locally and pass in CI is a property of the
  platform difference, not of this change. Making CI run the smoke on macOS is a workflow decision with its
  own cost, recorded here so the asymmetry is not mistaken for something this design introduced.
