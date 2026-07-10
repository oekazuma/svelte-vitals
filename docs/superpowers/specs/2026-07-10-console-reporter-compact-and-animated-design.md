# Design: Compact-by-default console reporter + score-reveal animation

**Date:** 2026-07-10
**Status:** Proposed
**Packages:** `@svelte-vitals/core` (reporter/console.ts only), `svelte-vitals` (CLI)

## Goal

Two related console-UX problems, both scoped to `packages/core/src/reporter/console.ts`
(`formatConsoleReport`) and its CLI caller (`packages/cli/src/index.ts`), leaving
every other reporter (json/html/md/github/sarif/agent) untouched:

1. **The terminal-flood problem.** On a large project, `formatConsoleReport` lists
   every failing result individually within its severity bucket, then lists every
   _passing_ result individually too (`Passed (N)` followed by N lines), and
   `--by-route` lists every route. None of this is capped — output scales linearly
   with project size with no way to see a a compact summary first.
2. **No delight.** The CLI's only animation today is a plain braille spinner
   (`packages/cli/src/spinner.ts`) during analysis. The health score — the single
   number a user most wants to see — just appears, with no visual payoff.

Both are addressed together because they touch the same call site and the same
"is this an interactive terminal" gating logic.

## Prior art consulted

[react-doctor](https://github.com/millionco/react-doctor) (Million.js team, a
similarly-shaped static code-health CLI) solves the flood problem by grouping
findings by rule (not by file), showing only the top-N highest-impact rule
groups by default with a "run with `--verbose`" escape hatch, and gives its
health-score header an animated reveal (ASCII face + score count-up with
easing, redrawn via ANSI cursor-up escapes) gated behind a careful
TTY/CI/agent/`TERM=dumb` check. We adopt the same two structural ideas
(rule-grouped capped output, animated score reveal) but not react-doctor's
specific dependencies (`ora`, `effect`, `is-unicode-supported`) or its "doctor
face" motif — svelte-vitals has never added a terminal-UI dependency
(`spinner.ts`, `color.ts` are both hand-rolled already) and this doesn't
change that. The animation motif is svelte-vitals' own: a pulse/heartbeat
line (chosen after reviewing three candidate motifs — pulse line, the
existing ↯ brand mark "charging up", and a combination — the pulse line won
for being the most direct fit for "vitals").

## Part 1: Compact-by-default output

### Grouping failures by rule within each severity bucket

Today, `formatConsoleReport` iterates every failing `Result` in a severity
bucket and prints it individually (id, message, route, location — 1-3 lines
each). Instead, group the bucket's results by `result.id` first:

- Sort the rule groups by descending group size (most-affected rule first);
  ties broken by rule id ascending, for deterministic output.
- By default (`verbose` option unset/false), show only the first
  `MAX_RULE_GROUPS_PER_BUCKET` groups (constant, **5**); each shown group
  prints its id/message once, then the first result's route/location (as
  today), then — only if the group has more than one result — a single dim
  line: `…and N more` (N = group size − 1). "more" is deliberately generic
  (not "more routes"), since some rules (correctness/architecture) fire on
  component-scoped, routeless results.
- If more than `MAX_RULE_GROUPS_PER_BUCKET` groups exist in a bucket, append
  one line after the shown groups: `…and N more rules affected — run with
--verbose to see all` (N = remaining group count, not remaining finding
  count — a rule count is the more legible number here).
- With `verbose: true`, skip capping and grouping-collapse entirely: every
  failing result prints exactly as it does today (this is the existing
  behavior, preserved verbatim as the escape hatch).

### Collapsing the Passed section

Today: `Passed (N)` header followed by N individual lines. Change the
default (non-verbose) behavior to just the header line — `Passed (N)` — with
no per-item listing. `verbose: true` preserves today's full per-item listing
unchanged.

### Capping `--by-route`

Today, `byRouteTree` lists every route alphabetically. Two changes:

1. **Always sort by score ascending (worst first)**, not alphabetically —
   this is a deliberate behavior change from today, since a "which routes
   need attention" view is more useful worst-first than alphabetically, and
   it's what makes a cap meaningful (the routes that get cut are the
   healthiest ones).
2. By default (non-verbose), show only the worst `MAX_ROUTES_BY_ROUTE`
   (constant, **10**) routes, then one summary line: `…and N more routes
(avg score S) — run with --verbose to see all` (N = remaining route
   count, S = the average score of the remaining/cut routes, rounded).
   `verbose: true` shows every route, still worst-first.

### New `verbose` option

`ConsoleReportOptions` gains `verbose?: boolean` (default `false`). This is
the single switch controlling all three capping behaviors above — there is
no independent flag per section. `formatConsoleReport`'s signature and
default (non-verbose) behavior are the only things changing; the function
stays pure (string in, string out) and framework-agnostic exactly as today.

### New `omitHeader` option (internal, CLI-only)

`ConsoleReportOptions` also gains `omitHeader?: boolean` (default `false`),
used only by the CLI when it has already animated the header itself (Part 2)
— `formatConsoleReport` then returns only the findings/passed/by-route body,
with no leading brand/Health/category lines. This keeps `formatConsoleReport`
a single pure function (one code path, not a header-renderer and a
body-renderer split across two exports) while letting the CLI avoid printing
the header twice. Public API consumers who never set `omitHeader` (which is
everyone but the CLI's own animation path) see no change to the header at
all.

## Part 2: Score-reveal animation

### What plays

When enabled (see gating below), instead of printing the Health header line
as static text, the CLI plays a short (~1.1s, 6 frames) in-place animation on
stdout: a pulse/heartbeat ASCII line that gradually settles from an erratic
waveform to a flat line, while the Health score counts up from 0 to its final
value in step with the frames. The final frame colors the settled score using
the console reporter's existing `scoreColor` thresholds (green ≥90, yellow
≥70, red otherwise — `packages/core/src/reporter/palette.ts`), matching every
other colored score in the console output. Category score lines are **not**
animated (see Non-goals) — they print statically, immediately after the
animated header settles, exactly as today.

Redraw technique matches `spinner.ts`'s existing approach: `\r` (return to
column 0) plus an ANSI cursor-up escape (`\x1b[2A`, two lines: the pulse line
and the score line) to overwrite the previous frame in place, rather than
scrolling the terminal. No new dependency — this is the same primitive
`spinner.ts` already uses, just applied to two lines instead of one.

### Gating

A new function, `scoreAnimationEnabled`, mirrors the existing
`spinnerEnabled` (`packages/cli/src/index.ts`) but checks **stdout** TTY
(the animation writes the actual report content, unlike the spinner which
writes status to stderr):

```ts
export function scoreAnimationEnabled(opts: {
  reporter: ReporterName;
  rawReporter: ReporterName | undefined;
  stdoutIsTTY: boolean;
  env: NodeJS.ProcessEnv;
  noColorFlag?: boolean;
  noAnimationFlag?: boolean;
}): boolean {
  return (
    opts.reporter === 'console' &&
    opts.stdoutIsTTY &&
    !opts.noAnimationFlag &&
    !isAutoDetectedAgent(opts.rawReporter, opts.env) &&
    colorEnabled({ reporter: opts.reporter, isTTY: opts.stdoutIsTTY, env: opts.env, noColorFlag: opts.noColorFlag })
  );
}
```

`--score` mode (`opts.score`) never reaches the console-reporter branch at
all (`packages/cli/src/index.ts` line ~370 returns earlier), so no explicit
check is needed there. When `scoreAnimationEnabled` is false — non-TTY,
piped, CI, an agent shell, `NO_COLOR`/`--no-color`, or the new
`--no-animation` — the CLI prints the ordinary static header exactly as
today (`formatConsoleReport` with `omitHeader` unset), so piping to a file or
`less`, or running in CI, is completely unaffected.

### New CLI flags

- `--verbose` — disables all Part 1 capping (long-form only; `-v` is already
  `--version`'s short alias, confirmed in `packages/cli/src/bin.ts`).
- `--no-animation` — disables the Part 2 animation even on an interactive
  TTY, joining `--no-color` as a `--no-*` boolean, same naming convention.

Both thread through `RunOptions` → the relevant call site exactly like
`--by-route`/`--no-color` do today.

## New / changed files

- `packages/core/src/reporter/console.ts` — rule-grouping/capping logic for
  the three sections above; `verbose`/`omitHeader` added to
  `ConsoleReportOptions`.
- `packages/cli/src/pulse-animation.ts` (new) — the animation itself:
  frame data, the redraw loop, `scoreAnimationEnabled`.
- `packages/cli/src/bin.ts` — parse `--verbose`/`--no-animation`.
- `packages/cli/src/index.ts` — thread the two new options through
  `RunOptions`; at the console-reporter call site, branch on
  `scoreAnimationEnabled(...)`: if true, await the animation, then call
  `formatConsoleReport(..., { omitHeader: true, verbose })`; if false, call
  `formatConsoleReport(..., { verbose })` unchanged (header included).

## Error handling

Matches `spinner.ts`'s existing level of care (no elaborate recovery): the
animation is a sequence of plain `stream.write` calls with a timed delay
between frames, same risk profile as the existing spinner. If stdout closes
mid-animation (e.g. `SIGPIPE` from a truncating pipe), that's the same
failure mode the rest of the CLI's stdout writes already have — not a new
concern this feature introduces.

## Testing

- **Grouping/capping (`console.ts`):** pure-function unit tests — multiple
  failing results sharing a rule id collapse into one group with an "…and N
  more" line; a bucket with more than 5 rule groups gets the "…and N more
  rules affected" trailer; `verbose: true` restores today's full listing;
  `Passed` collapses to a bare count by default and lists every item under
  `verbose`; `--by-route` sorts worst-first and caps at 10 with a trailer,
  uncapped and still worst-first under `verbose`.
- **Existing `console.ts` tests:** several currently assert the old
  (uncapped, alphabetical-by-route) default behavior — these need updating
  to reflect the new default, not just additive new tests.
- **`scoreAnimationEnabled`:** pure-function unit tests covering each gate
  (non-TTY, CI/agent env, `NO_COLOR`/`--no-color`, `--no-animation`,
  non-console reporter) independently, mirroring `spinnerEnabled`'s existing
  test coverage.
- **`pulse-animation.ts`'s frame loop:** uses injected/fake timers (matching
  the project's existing convention for other timed logic, e.g.
  `packages/vite/src/ui/analysis.ts`'s tests) rather than real sleeps —
  assert the final frame's written output contains the correct
  final score and color, without asserting on exact intermediate frame
  timing. Matches the project's established stance (spinner.ts,
  dashboard-script.ts) of not deeply unit-testing animation frame-by-frame
  rendering — verified instead by manual check in a real terminal before
  shipping.
- **CLI flag wiring:** `--verbose`/`--no-animation` parse correctly in
  `bin.ts` and thread through to `RunOptions` in `index.ts`, alongside the
  existing `--by-route`/`--no-color` tests.

## Non-goals

- Animating the category score lines (SEO/Performance/etc.) — the header's
  score-and-face-equivalent reveal is in scope; category bars stay static.
  A future follow-up, not blocking this.
- Any change to json/html/md/github/sarif/agent reporters — this is
  `console.ts` (and its CLI caller) only.
- A new terminal-UI dependency (`ora`, `ink`, etc.) — hand-rolled, matching
  every other CLI/UI surface in this codebase.
- Reduced-motion / accessibility signaling beyond the existing
  TTY/CI/`NO_COLOR`/agent gates and the new `--no-animation` flag — there is
  no terminal equivalent of `prefers-reduced-motion` to detect automatically.

## Release

`@svelte-vitals/core` and `svelte-vitals` (CLI) both **minor** — new options
and flags, backward compatible (`verbose` defaults to `false` but changes
what "false" produces for `console.ts`'s **existing consumers**, which is
the entire point; `omitHeader` defaults to `false`, fully non-breaking for
anyone but the CLI's own animation path). Requires changesets for both
packages per `AGENTS.md`.

## Documentation

Update `packages/cli/README.md` (and the CLI guide under
`docs/src/content/docs/`, en + ja) to document `--verbose` and
`--no-animation`, and to note that the console reporter's default output is
now capped (with a pointer to `--verbose`).
