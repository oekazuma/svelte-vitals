# Design spike: dev-server event-loop occupancy from whole-project analysis

> Originating plan: `plans/037-design-spike-dev-server-analysis-isolation.md`. This is
> a measure-first spike — the deliverable is measurement data and a decision, not a
> `worker_threads` implementation.

## Background

`packages/vite/src/ui/analysis.ts`'s `createAnalysisRunner` calls `analyzeProject`
(from `svelte-vitals`, i.e. `packages/cli/src/index.ts`) on a debounced timer after
every relevant source-file save while `vite dev` is running. That call runs
synchronously on the same Node event loop that `packages/vite/src/ui/middleware.ts`
uses to serve `/ingest`, `/events` (SSE), and `/data.json` for the dev dashboard.
`analyzeProject` → `collectRoutes` walks every route's layout chain and parses each
`.svelte` file with `svelte/compiler`'s synchronous `parse()`
(`packages/cli/src/providers/source/parse.ts`). The audit that produced Plan 037
flagged this as a _plausible_ blocking pattern on large projects, but explicitly
labeled it MED confidence and unmeasured. This document is the measurement.

## Method

### Fixture generation

The existing CLI test fixtures top out at 9 routes (`packages/cli/test/fixtures/basic-project`,
confirmed by `find <fixture> -name '+page.svelte' | wc -l` across every fixture in
`packages/cli/test/fixtures/`), far too small to stress the parse pipeline. A
disposable generator, `packages/vite/scripts/bench/gen-project.mjs`, synthesizes a
SvelteKit-like project with N pages grouped into sections of 20, each section with
its own `+layout.svelte` (so `chainFiles`/`resolveRoute` do real multi-file layout
resolution, not flat single-layout inheritance). Each page has a realistic head
(`title`, `meta description`, two `og:*` tags, a canonical `link`, a JSON-LD
`<script>`), two headings, body copy, two component usages, and two `<img>` tags —
comparable in shape to the project's own `basic-project` fixture page, just
mechanically repeated.

### Measurement

`packages/vite/scripts/bench/bench.mjs` calls `analyzeProject({ cwd })` directly
(the same function `runOnce` invokes) against the generated project and measures, per
run:

1. **`perf_hooks.monitorEventLoopDelay`** — a fresh `Histogram`, `enable()`d
   immediately before the `analyzeProject()` call and `disable()`d immediately after;
   reports min/mean/p50/p99/max event-loop delay in ms for exactly that window.
2. **Classic tick-drift check** — a `setInterval` firing every 10ms for the same
   window, recording the actual gap between ticks. A busy event loop shows up as
   gaps far larger than 10ms. Reports the max gap and, using the plan's own suggested
   "distinctly blocked" cutoff of 100ms, the count of ticks exceeding it plus the
   cumulative "excess" time — the sum of (gap − 10ms) across only those over-threshold
   ticks, i.e. time spent waiting beyond what a healthy 10ms-spaced tick would take.

Both methods run concurrently in the same process/window so they cross-check each
other rather than relying on a single measurement API.

Each project size was measured with one discarded warmup run (primes the OS file
cache) followed by 5 timed runs. Environment: Node v24.16.0, darwin/arm64, Apple M2
Pro (12 logical cores), 34GB RAM — a single-machine, single-run-at-a-time
measurement, not a CI-grade benchmark; treat absolute numbers as indicative of order
of magnitude, not a guarantee across all hardware.

Both scripts are throwaway (per Plan 037's scope) and left in
`packages/vite/scripts/bench/` per the plan's maintenance note, since they may be
reusable for measuring Plan 034/036's cache-hit effects later. No tests were written
for them, by design.

## Results

### Required range (50 / 200 / 500 routes), median of 5 timed runs (min–max in parens)

| Routes | Findings | Total `analyzeProject` time | Event-loop delay, max (perf_hooks) | Event-loop delay, p99 |   Tick-drift max gap | Ticks >100ms |
| -----: | -------: | --------------------------: | ---------------------------------: | --------------------: | -------------------: | :----------- |
|     50 |     1465 |        25.7ms (24.6–29.6ms) |                 9.7ms (7.9–10.2ms) |    9.7ms (7.9–10.2ms) | 12.1ms (12.0–14.3ms) | 0/5 runs     |
|    200 |     5829 |        87.9ms (85.7–92.7ms) |               17.8ms (12.7–26.8ms) |  17.8ms (12.7–26.8ms) | 19.2ms (17.1–26.8ms) | 0/5 runs     |
|    500 |    14559 |     215.6ms (211.6–233.1ms) |               51.8ms (42.9–58.9ms) |  51.8ms (42.9–58.9ms) | 51.8ms (42.9–61.2ms) | 0/5 runs     |

Across all 15 timed runs in the plan's required range (50/200/500 × 5 runs), **not a
single tick exceeded the 100ms "distinctly blocked" threshold**, and the worst single
event-loop-delay sample observed anywhere in that range was 61.2ms (500 routes, run
3, tick method). The measurement was stable — no threshold-straddling or run-to-run
flip-flopping that would require flagging this as inconclusive per the plan's STOP
condition.

### Supplementary data beyond the plan's required range (1000 / 2000 routes, 3 runs)

Run to see where the pattern would eventually become a real problem, since a flat
"no problem up to 500" result invites the natural follow-up "what about 501+":

| Routes | Findings | Total time (median) | Event-loop delay max (median) | Tick-drift max gap (median) | Ticks >100ms                                 |
| -----: | -------: | ------------------: | ----------------------------: | --------------------------: | :------------------------------------------- |
|   1000 |    29109 |             430.7ms |                        68.6ms |                      66.5ms | 0/3 runs                                     |
|   2000 |    58209 |             844.9ms |                       190.8ms |                     190.8ms | 1–2 per run, 180.8–271.6ms cumulative excess |

At 2000 routes the event-loop delay and tick-drift max crossed 100ms in every run
(150.9–212.5ms), with 1–2 individual stalls per run and 180–272ms of cumulative
excess blocked time. The scaling from 1000→2000 routes (roughly 2× the files) is
noticeably super-linear in the tail latency (68.6ms → 190.8ms, not ~137ms), which
looks consistent with GC pressure from the much larger live object graph (58k
`Result`s, ~2x the parsed ASTs held briefly in flight via `Promise.all`) rather than
pure parse-CPU scaling — plausible but not verified further, since it's outside the
plan's required range.

## Decision: defer `worker_threads` migration

**No isolation work is warranted at this time.** Rationale:

- In the plan's required 50/200/500-route range — which already exceeds every
  existing fixture in the repo by 5–50× and is a reasonable proxy for "large
  SvelteKit project" — the worst observed single event-loop stall was ~61ms, and the
  whole `analyzeProject()` call finished in under 235ms even at 500 routes. Both are
  well under the "HMR feels responsive" ballpark (tens of ms per interaction,
  hundreds of ms tolerable) and nowhere near the plan's own 100ms "distinctly
  blocked" cutoff.
- The call site (`createAnalysisRunner.runOnce`) is already debounced 500ms
  (`packages/vite/src/ui/analysis.ts`), so even a worst-case single 61ms stall inside
  a 215ms background analysis is a small, one-off blip relative to the debounce
  window and to normal Vite dev-server request latency — not a `worker_threads`-shaped
  problem.
- The point at which blocking becomes clearly real (>100ms stalls, reproducible) was
  measured at 2000 routes — roughly 4× larger than the plan's own upper bound and far
  beyond any fixture or known user project in this codebase today.
- `worker_threads` isolation carries real cost (Plan 037's own risk assessment: L
  effort, MED risk — message-passing `Result[]`/error propagation, worker lifecycle
  tied to `runner.stop()`, fallback-to-inline-on-worker-startup-failure). Building
  that now, with no evidence of an actual problem in the range that matters, would be
  speculative investment against the project's stated preference to avoid
  overbuilding pre-1.0 (see `plans/README.md`'s recurring "measure
  before building" pattern in prior spikes).

Per Plan 037's Done criteria, this decision belongs in `plans/README.md`'s
"Findings considered and rejected" section — per the executor instructions for this
task, that file is intentionally left untouched here; the reviewer maintains the
index and should transcribe the following line:

> **037 — dev-server whole-project analysis blocking the event loop**: measured
> (`docs/superpowers/specs/2026-07-13-dev-server-analysis-isolation-design.md`),
> not observed as a real problem up to 500 routes (max single event-loop stall
> ~61ms, well under the 100ms threshold and the runner's own 500ms debounce);
> `worker_threads` isolation deferred. Revisit if a real project's route count
> approaches ~1000–2000 (where >100ms stalls start appearing in this benchmark).

## When to revisit

- A user report or benchmark showing a real project in the ~1000+ route range (the
  benchmark shows blocking becoming measurable there, and clearly real by 2000
  routes).
- If Plan 034 (persistent parse cache across debounced re-analyses) ships and later
  measurement shows the _steady-state_ re-analysis-on-save cost is dominated by
  something other than parse (e.g. rule evaluation over a much larger `Result[]`),
  that would be a different bottleneck than the one this spike investigated and
  would need its own measurement.
- `packages/vite/scripts/bench/` is left in place specifically so a future spike (or
  a re-run of this one) doesn't have to rebuild fixture generation from scratch.

## Artifacts

- Generator: `packages/vite/scripts/bench/gen-project.mjs`
- Benchmark: `packages/vite/scripts/bench/bench.mjs` (run via
  `node packages/vite/scripts/bench/bench.mjs --sizes=50,200,500 --runs=5`, from
  `packages/vite/`)
- Raw JSON output for the runs tabulated above is reproducible by re-running the
  command above; it was not checked in (throwaway, per Plan 037's Test plan section)
  beyond the summary tables in this document.
