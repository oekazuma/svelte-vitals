# The three bench-gated items, decided

Phase B-5 of `2026-08-16-v1-roadmap.md`, which asked for one measurement pass and a decision on
each item held behind it — "implement or record 'not needed at 1.0 scale'. A decision either way is
the deliverable."

**Two are deferred and one must be implemented.** The `fs` concurrency cap turned out to be the item
the measurement was for: under a low descriptor limit the analysis does not fail, it **silently
analyses part of the project and reports a normal score**.

## Measured 2026-08-17

`pnpm bench` times one whole-project `analyzeProject()` — the same call the dev server makes on
every save — over generated SvelteKit-like projects, and reports how long it blocks the event loop
(`monitorEventLoopDelay`). Medians of 3 runs, on a laptop. Absolute values are not comparable across
machines; the **shape** is what these were run for.

| routes | median  | per-route | results | event-loop delay p99 |
| ------ | ------- | --------- | ------- | -------------------- |
| 50     | 26.8ms  | 0.54ms    | 1 415   | 12.9ms               |
| 200    | 87.0ms  | 0.43ms    | 5 629   | 29.2ms               |
| 500    | 204.8ms | 0.41ms    | 14 059  | 80.0ms               |
| 1000   | 407.1ms | 0.41ms    | 28 109  | 127.3ms              |

`pnpm bench --target examples/kitchen-sink` — the real app, 27 routes and every rule firing:
**28.8ms**, event-loop delay p99 10.2ms.

Two real-world points from the Phase B-3 ecosystem work, measured through the CLI (so including all
I/O), are the most load-bearing numbers here because nobody wrote those projects for us:

- `huntabyte/shadcn-svelte` `docs` — **1 681 routes in 1 225ms**
- `lissy93/networking-toolbox` — 541 routes in 1 100ms

## Where the time actually goes

Aggregate timing cannot tell one phase from another, so the two CPU-bound items were decided from a
`--cpu-prof` capture of a 1 000-route run instead. Self time, as a share of 1 274ms sampled:

| phase                                                      | self time | share    |
| ---------------------------------------------------------- | --------- | -------- |
| fact-extraction walks (`collect*`/`scan*`/`walk*` in core) | 273ms     | 21.4%    |
| Svelte compiler parse (incl. acorn, zimmerframe)           | ~185ms    | 14.5%    |
| CLI collection total                                       | 106ms     | 8.3%     |
| — of which route resolution and composition                | **10ms**  | **0.8%** |
| `fs` (`node:fs`, `node:internal/fs/promises`)              | 40ms      | 3.2%     |
| rule `check()` bodies                                      | 25ms      | 1.9%     |

**Per-route cost also falls as the project grows** — 0.54ms at 50 routes, 0.41ms from 500 on, flat
to 1 000. No superlinear growth was observed in the measured range; that is not a proof that no
superlinear term exists beyond 1 000 routes, which is simply not measured here.

## 1. Composition memoization — deferred

Gated on route composition being a hot spot that repeats work across routes.

**It is 0.8% of sampled CPU** — 10ms of 1 274ms at 1 000 routes. That is the ceiling on what
memoizing it can return, and it is measured on the phase itself rather than inferred from the
aggregate curve. An earlier draft of this document argued the deferral from `ParseCache` sharing the
work instead; that was wrong as reasoning — `ParseCache` memoises read and parse per file, while
route resolution and `composeA11y` still run per route — and the profile makes the argument
unnecessary.

**Revisit when** composition's share grows, which the cross-component work in roadmap Phase C could
plausibly do.

## 2. Seven-walk consolidation — deferred

Gated on AST walking dominating. Each `.svelte` file is walked several times by separate collectors,
and folding them into one pass would cut constant-factor CPU.

**Walking is the largest single phase — 21.4% of sampled CPU** — so this one is gated on the right
thing, and the profile confirms it rather than dismissing it. But consolidation does not remove that
21.4%; it removes the _redundant traversal_ portion of it, while every collector still does its own
per-node work. The upper bound is therefore a fraction of 273ms on a 1 000-route project, against a
rewrite of every collector into one traversal — the highest-regression-risk change on the roadmap,
in the subsystem this release has just spent five PRs correcting.

Deferred on that trade, not on the size of the phase. **Revisit when** there is a project whose
analysis time is a complaint, so the payoff can be measured against a real number rather than a
share.

## 3. `fs` concurrency cap — deferred

Gated on unbounded parallel reads exhausting descriptors. **They do**, and the failure is worse than
a crash.

The earlier evidence — the ecosystem job analysing shadcn-svelte's 1 681 routes without error — was
measured on a machine whose `ulimit -n` is 1 048 576. Rerunning the same real project under limits
people actually have:

| `ulimit -n` | routes analysed    | findings | files skipped | reported health |
| ----------- | ------------------ | -------- | ------------- | --------------- |
| 256         | **232** of 1 681   | 93       | 1 450         | **94**          |
| 1 024       | **1 000** of 1 681 | 150      | 682           | **94**          |
| 4 096       | 1 681              | 191      | 0             | **94**          |
| 1 048 576   | 1 681              | 191      | 0             | **94**          |

`EMFILE` is raised on `open`, but every read is inside the per-file `try`/`catch` that exists for
malformed components, so it lands as `parseFailed` — the file is dropped and the run continues. At
1 024, a common container default, **40% of a real project goes unexamined, 41 findings disappear,
and the reported score does not move**. The only signal is a line on stderr; nothing in the JSON
report says how much was skipped.

That is the failure mode this project can least afford: not a crash, which is loud, but a plausible
green answer computed over part of the input. **Implement.** The fix is a bounded read concurrency
so descriptors cannot be exhausted, and — separately worth considering — distinguishing "could not
be read" from "could not be parsed", so an environment problem does not masquerade as a malformed
component.

The event-loop figure is unrelated and stands on its own: a save on a 1 000-route project blocks the
loop ~127ms, of which `fs` is 3.2% of CPU. Capping concurrency is for correctness here, not speed —
it will not shorten a CPU-bound block.

## What this does not measure

- **The CLI's own collection phase.** `pnpm bench` times `analyzeProject()`; the CLI's I/O count is
  gated separately and deterministically by `packages/cli/test/io-budget.test.ts`, which is the
  regression guard CI actually runs. This benchmark exists for the two things call counts cannot
  catch — a widened analysis and lost parallelism — and neither shows.
- **Cold cache and network filesystems.** Every run here is warm and local.
- **Anything at 10 000 routes.** The largest project measured, synthetic or real, is under 1 700.
- **How the profile splits between redundant and necessary traversal.** The 21.4% is all walking;
  what consolidation could actually return is a subset that this capture does not separate.
