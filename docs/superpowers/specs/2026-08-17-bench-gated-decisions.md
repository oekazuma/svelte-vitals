# The three bench-gated items, decided

Phase B-5 of `2026-08-16-v1-roadmap.md`, which asked for one measurement pass and a decision on
each item held behind it — "implement or record 'not needed at 1.0 scale'. A decision either way is
the deliverable."

**All three are deferred, with the numbers that say so.** None is refused on principle; each is
gated on a shape the measurement does not show.

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

## The shape that decides all three

**Per-route cost falls as the project grows** — 0.54ms at 50 routes, 0.41ms from 500 on — and then
holds flat to 1 000. Analysis is linear in project size with a fixed startup amortised away; there
is no superlinear term for an optimisation to attack.

## 1. Composition memoization — deferred

Gated on route composition being a hot spot that repeats work across routes. It would be, if per-route
cost climbed with route count: a route's composed chain is re-walked per route, so shared layouts and
`$lib` components would be re-processed N times.

The curve says otherwise. Flat 0.41ms per route from 500 to 1 000 means the repeated work is either
already cheap or already shared (`ParseCache` memoises read+parse per file per run, which is where
the duplication would have been). Memoizing composition on top would add a cache to maintain for a
term the measurement cannot see.

**Revisit when** per-route cost starts climbing with size rather than falling — that is the signature
this optimisation exists for.

## 2. Seven-walk consolidation — deferred

Gated on AST walking dominating. Each `.svelte` file is walked several times by separate collectors,
and folding them into one pass would cut constant-factor CPU.

At 1 000 routes the entire analysis is 407ms, so the ceiling on this optimisation is a fraction of
half a second on a project larger than any in the ecosystem corpus. Against that, consolidation
means rewriting every collector into one traversal — the change with the highest regression risk of
anything on the roadmap, in the subsystem this release has just spent five PRs correcting.

The trade is unattractive in exactly the way 1.0 should avoid: a large, risky refactor of freshly
audited code, for a constant factor nobody is waiting on.

**Revisit when** a profile shows walking rather than I/O dominating a run users complain about.

## 3. `fs` concurrency cap — deferred

Gated on unbounded parallel reads causing descriptor exhaustion or thrash. Two measurements bear on
it, and they point the same way:

- **No exhaustion at real scale.** The ecosystem job analysed shadcn-svelte's 1 681 routes without
  error. That is the largest real SvelteKit app in the corpus and it never came close.
- **The blocking is not I/O.** Event-loop delay p99 rises with size (12.9 → 127.3ms), but the
  analysis is synchronous parsing between awaits; a concurrency cap throttles reads, which would not
  shorten a CPU-bound block. Capping would make the run slower without making it smoother.

**Revisit when** an `EMFILE` is reported, or a profile attributes the delay to I/O rather than
parsing. The one number worth carrying forward is that p99: a dev-server save on a 1 000-route
project blocks the loop for ~127ms, which is the figure to beat if dashboard responsiveness ever
becomes the complaint.

## What this does not measure

- **The CLI's own collection phase.** `pnpm bench` times `analyzeProject()`; the CLI's I/O count is
  gated separately and deterministically by `packages/cli/test/io-budget.test.ts`, which is the
  regression guard CI actually runs. This benchmark exists for the two things call counts cannot
  catch — a widened analysis and lost parallelism — and neither shows.
- **Cold cache and network filesystems.** Every run here is warm and local.
- **Anything at 10 000 routes.** The largest project measured, synthetic or real, is under 1 700.
