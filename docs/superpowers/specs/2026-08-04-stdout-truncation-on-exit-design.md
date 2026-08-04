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

The file already knows. `bin.ts` line 85 onward:

> `docs` and `explain` set `process.exitCode` and return rather than calling `process.exit`: writes to a pipe
> are asynchronous, and exiting can discard whatever has not drained. … (`install`/`ci` and the analysis path
> below still exit directly — they hold prompts and timers, where returning could hang instead; **their
> large-output paths deserve the same treatment separately.**)

This is that separately. `--reporter json` is the largest thing the CLI writes, it is the channel CI and
agents use, and the release immediately before this one changed every score in it — so it is also the payload
people are about to re-read.

## Why CI never caught it — and why it is not a macOS bug

Node writes stdout asynchronously to pipes on **every** POSIX platform ("Pipes (and sockets): synchronous on
Windows, asynchronous on POSIX"). So Linux is not exempt, and the first draft of this section — which claimed
Linux was synchronous — had the documentation backwards.

The difference is the **channel**, not the platform. `execFileSync`, which the smoke uses, does not give the
child a pipe:

| channel                 | child's fd 1        | buffer                |
| ----------------------- | ------------------- | --------------------- |
| `execFileSync(...)`     | `isSocket() → true` | AF_UNIX socketpair    |
| `cmd \| cat` in a shell | `isFIFO() → true`   | pipe, 65,536 on Linux |

Both verified by `fstatSync(1)` in a child. A socketpair's effective capacity is **exactly 65,536 bytes** on
macOS — measured by binary search, a child writing N bytes then exiting delivers all of N below that and
exactly 65,536 above it — against a stock Linux `wmem_default` of 212,992. So the 67,656-byte report should
fit on a Linux runner and is cut on a macOS laptop. The Linux figure is a kernel default this design cannot
measure from here; the CI run mandated under Testing corroborates the mechanism directly rather than resting
on it.

CI is green because its channel is wide, not because its platform is synchronous.

**Two consequences, both of which the first draft got wrong.**

- **A Linux user piping to `jq` is affected too.** A real shell pipe has a 65,536-byte buffer on Linux and
  asynchronous writes, so `svelte-vitals --reporter json | jq` truncates there for the same reason it does
  here. Written as an expectation in the draft and **confirmed by the CI run this design mandated** — see
  "The result" under Testing. This is not a macOS-only defect, and it lands on the platform every CI consumer
  runs on.
- **The regression is CI-defensible after all.** Routing the CLI through a real pipe —
  `execFileSync('sh', ['-c', '… bin.js … --reporter json | cat'])` — exercises the 65,536-byte channel on
  Linux. Measured through `sh -c … | cat` on macOS: **65,536 bytes, truncated**, against 67,656 through the
  fix. The first draft asserted CI could not catch this and did not try.

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

Flushing gets the same measured result. It does change termination in one corner, which is worth stating in
the section that rejects the alternative on termination grounds: piped to a reader that never reads
(`| sleep 30`), the unpatched CLI exits immediately with a truncated payload while the patched one blocks
until the reader reads or closes. That is what a well-behaved Unix writer does, and it is bounded by the
reader's lifetime — unlike a held event loop, which is bounded by nothing.

### Scope

**Only the analysis path.** `install` and `ci` also call `process.exit`, and the same hazard applies to them
in principle, but neither writes anything close to a pipe buffer — `install` prints a plan, `ci` prints a
scaffold summary. Adding the flush there would be speculative; adding it when one of them grows a large
output is the same one-line change. Recorded, not done.

`docs` and `explain` are already safe and are not touched.

## Testing

**One check exists and already fails locally; one must be added so CI can fail too.**

`scripts/floor-smoke.mjs` has `analysing a real project emits a well-formed JSON report`, which runs the
built CLI through `execFileSync` and `JSON.parse`s the whole payload. On macOS today it fails with
`SyntaxError: Unterminated string in JSON at position 65488`, and the fix makes it pass. That is a real
regression test — but only on macOS, because its channel is a socketpair whose Linux buffer swallows the whole
report.

So **add a sibling check that routes the report through a true pipe**, alongside the existing
`the read-only subcommands deliver complete JSON through a pipe` — whose comment already names this exact
mechanism, and which covers only `docs` and `explain`, the two paths that already return instead of exiting.

**Three details decide whether that check holds anything.** An earlier draft of this section prescribed
`execFileSync('sh', ['-c', `${cliCmd} --reporter json | cat`])` and each of the three defeats it:

- **It must capture and parse the payload.** `execFileSync` throws only on a nonzero exit, and a pipeline's
  status is the _last_ command's — `cat`'s. Measured: `sh -c 'exit 1 | cat'` and even
  `sh -c 'no-such-cmd | cat'` both exit 0 and do not throw. A check that only runs the pipeline passes
  against the unfixed CLI, against a truncated payload, and against a CLI that never launched.
- **The path must not be interpolated into the shell string**, which word-splits on a checkout containing a
  space. Use positional parameters.
- **It must not assert the exit code.** The CLI's 0/1/2 contract cannot survive `| cat` — measured, the CLI
  exits 1 while `sh` reports 0. `set -o pipefail` would need bash semantics from `/bin/sh`, which is `dash` on
  `ubuntu-latest`. So this check owns **payload integrity only**; exit-code fidelity stays with the existing
  socketpair check, which asserts it correctly today.

The form that satisfies all three, verified here — 65,536 bytes and
`Unterminated string in JSON at position 65488` without the fix, 67,656 and valid JSON with it:

```js
const stdout = execFileSync(
  'sh',
  ['-c', '"$1" "$2" "$3" --reporter json | cat', 'sh', process.execPath, cliBin, basicProject],
  {
    encoding: 'utf8',
    // stderr inherited, not ignored: a clean `--reporter json` run writes nothing there (the spinner and
    // mascot are console-reporter-and-TTY gated), so passing runs stay silent — and when the fixture is
    // broken, the CLI's own reason beats `Unexpected end of JSON input` as the thing the smoke prints.
    stdio: ['ignore', 'pipe', 'inherit']
  }
);
JSON.parse(stdout);
```

`sh` is the OS shell, not a dependency, so this respects the smoke's Node-builtins-only rule; every CI job
runs `ubuntu-latest` and every developer machine here is POSIX.

**The order of work matters, and the plan must follow it.** Add the pipe check _before_ the fix and push it,
so CI runs it against the unfixed CLI.

**Read the result asymmetrically, because only one direction is deterministic.** Truncation is a race the
writer usually wins: measured 12 of 12 truncations here, but the reviewer of this design saw 1 run in 15
deliver the whole payload, because the reader can drain the FIFO during the writer's syscall. So:

- **Any truncation, on any run, confirms it.** One red is proof; the check is then permanently valuable
  because the flush makes delivery deterministic — after the fix it cannot flake red.
- **Green does not settle anything on its own.** The `test` job runs the smoke on three matrix entries and
  `floor-smoke` runs it again, so a single push already yields four samples; treat "cannot defend the
  regression on Linux" as established only after repeated all-green across pushes, and record the measured
  fact here if that happens.

The same CI run also corroborates the channel explanation directly: the socketpair check green beside the pipe
check red, same runner, same unfixed binary, is channel-dependence demonstrated rather than inferred from a
kernel default this design could not measure.

### The result, recorded 2026-08-04

**The experiment ran and Linux truncates.** PR #364 pushed the pipe check alone, against the unfixed CLI:
`test (24.16.0)` and `floor-smoke` both failed at the smoke step on `ubuntu-latest` (the other two matrix
entries were cancelled by fail-fast). The commit adding the fix turned all seven jobs green, including all
four that run the smoke.

So this is not a macOS-only defect: `svelte-vitals --reporter json | jq` was truncated on Linux too, and the
check now defends the regression on the platform CI runs. Nothing about the asymmetric reading above needs to
be exercised — one red settled it on the first push.

The failing check was identified by inference rather than from the log text, which this environment cannot
fetch: `main` had `floor-smoke` green, and the only code change on the pushed commit was the added check.

**One thing to know rather than assert.** The check only means anything while the fixture's report exceeds
65,536 bytes; it is 67,656 today, 3% above. A fixture that shrank below the buffer would make the check pass
everywhere for the wrong reason. Not worth pinning with a byte-count assertion that would then need
maintaining, but worth knowing before anyone trims the fixture.

## Deliberately not solved

- **`install` and `ci`.** See Scope. Measured output: at most 1,377 bytes for `install --dry-run` across every
  client, 85 bytes for `ci` — two orders of magnitude under any buffer.
- **A general "flush before every exit" helper.** One call site does not justify an abstraction. The other
  `process.exit` sites in `bin.ts` are `install` (line 103), `ci` (107) and two argument-validation failures
  (148, 156); the validation pair writes to stderr, and the first of them follows a loop that can emit several
  lines — still far under a buffer, and stderr is unbuffered to a terminal anyway.
- **`--out-file -` in its space-separated form.** Found while measuring this: `--reporter html --out-file -`
  silently writes `svelte-vitals-report.html` into the cwd instead of stdout, because `mri` parses a lone `-`
  as `""` and mangles the following arguments. `--out-file=-` works. Unrelated to the exit path — the flush
  covers html-to-stdout correctly (81,333 bytes intact through a pipe) — so it needs its own issue rather
  than a fix here.
- **Whether the smoke should also run on macOS in CI.** If the new pipe check fails on Linux as expected, the
  platform asymmetry stops mattering for this bug and a macOS runner buys little. Recorded so the asymmetry is
  not mistaken for something this design introduced.
