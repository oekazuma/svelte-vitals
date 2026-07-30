# Design: guarding analysis speed in CI with a deterministic I/O budget

**Date:** 2026-07-29
**Status:** Approved for implementation.
**Packages:** `svelte-vitals` (CLI) only. No `@svelte-vitals/core` source changes.
No public API changes, so no changeset.

## Goal

svelte-vitals is fast because of deliberate design choices, not incidental luck.
Nothing currently defends those choices: a PR can break the parse cache, add a
second directory traversal, or give a new rule its own file reads, and CI stays
green. This design adds a **regression gate that cannot be flaky**, plus a
manual tool for the (real, but noisier) questions the gate cannot answer.

## Why not a timing benchmark in CI

`packages/vite/scripts/bench/bench.mjs` already exists and still works — a run on
2026-07-29 reproduced the numbers in
`2026-07-13-dev-server-analysis-isolation-design.md` exactly (50 routes → 1465
findings, ~25ms). But it is unfit as a CI gate:

- GitHub's shared `ubuntu-latest` runners vary by 1.5–2× under neighbour load.
  Absolute thresholds on 25ms/215ms figures would fail spuriously until everyone
  learns to ignore the red — the standard way perf CI dies.
- The benchmark's headline metrics (event-loop delay, tick drift) exist to answer
  "does this block the dev server", not "is this slower than last week". They do
  not survive cross-machine comparison.

So the gate measures **counts**, not time. Counts come from the `Runtime`
interface, are identical on every machine, and cannot be flaky.

## What counts can and cannot catch

Deciding this explicitly matters, because the gate must not be mistaken for
complete coverage.

**Caught:** parse-cache breakage, duplicate reads, repeated directory
traversals, a new rule or collector doing its own I/O, loss of the
single-glob-per-pattern property.

**Not caught, by construction:**

- **Widening the analysis** — e.g. abandoning the "we do NOT follow the
  expression" boundary in `packages/core/src/svelte-ast.ts`. I/O counts stay
  identical while AST walk volume grows.
- **Losing parallelism** — replacing a `Promise.all` with sequential `await`
  leaves every call count unchanged.

Both are visible only in wall-clock time. They are the reason the timing
benchmark is kept and promoted to a documented manual tool rather than deleted.

## Measured starting point

A counting `Runtime` was injected into `collectRoutes`, `collectComponentFacts`
and `collectKitModuleFacts` on a 4-file fixture (2 routes, a shared root layout,
a shared `$lib` component). `collectProjectFacts` was not part of this probe, so
its config-file reads are not reflected below:

```
after collectRoutes:  every .svelte = 1 read
after all collectors: every .svelte = 2 reads
globs:                9 patterns, each called exactly once
```

**Every `.svelte` file is read and parsed twice per run.** `collectRoutes`
(head resolution, `parseFile`) and `collectComponentFacts` (component facts,
`parseComponentFacts`) use different parsers and separate caches, and
`collectComponentFacts`'s `src/**/*.svelte{,.ts,.js}` glob also matches route
files. This is not a bug — the two parsers extract different facts — but it is
the largest single I/O redundancy in the pipeline, and the budget makes any
future unification measurable.

## Design

### 1. Extract the collection step

New file `packages/cli/src/collect-all.ts`, holding what is today inline in
`analyzeProject` (`packages/cli/src/index.ts:208-217`):

```ts
export interface CollectedFacts {
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  project: Project;
  components: ComponentFacts[];
  kitModules: KitModuleFacts[];
  /** `undefined` (not `[]`) for a route-filtered run. */
  sourceFiles: string[] | undefined;
}

export async function collectAll(
  rt: Runtime,
  cwd: string,
  config: Config,
  opts?: { route?: string; parseCache?: ParseCache }
): Promise<CollectedFacts>;
```

This moves every collector call and the route filtering. `detectProject` and
`checkVersionFloor` stay in `analyzeProject`: they are validation with their own
error semantics (`ProjectError` → exit 2), not collection.

`collect-all.ts` is **not** re-exported from `index.ts`. Tests import
`../src/collect-all.js` directly, matching how `parse-cache.test.ts` already
imports `../src/providers/source/routes.js`. The public API is unchanged and
`check:publish` is unaffected.

The extraction is what lets the budget test call the **real** pipeline: a collector
added later falls under the read and glob budgets automatically. One exception —
a collector that is skipped when `route` is set must also be added to invariant 4's
expected list. That happened for real during this work: `main` gained
`collectSourceFiles` while the branch was in review, and invariant 4 went red until
its glob was admitted.

### 2. Counting Runtime helper

New file `packages/cli/test/helpers/counting-runtime.ts`:

```ts
export interface RuntimeCounts {
  readFile: Map<string, number>;
  exists: Map<string, number>;
  glob: Map<string, number>;
}

export function createCountingRuntime(base: Runtime): { rt: Runtime; counts: RuntimeCounts };
```

The local `withReadSpy` in `packages/cli/test/parse-cache.test.ts` is replaced by
this helper, removing the duplication.

All budget tests live in `packages/cli/test/`. `collectComponentFacts` and
`collectKitModuleFacts` are core functions but are importable from the CLI
package, and `collectAll` calls every collector, so one location covers
everything. Core's own test helpers are left alone: `createMemoryRuntime` is
duplicated across `packages/core/test/component-collect.test.ts` and
`kit-module-collect.test.ts` with a different (pattern-hardcoded) glob
implementation from the CLI's, and unifying them would risk changing existing
test behaviour for no benefit to this goal.

### 3. The invariants

New file `packages/cli/test/io-budget.test.ts`, run by the existing `test` CI
job. It uses the in-memory Runtime, so its contribution to CI time is negligible.

| #   | Invariant                                                                                                         | Regression it catches                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 1   | Each file is read at most **twice**                                                                               | Parse-cache breakage, duplicate reads, a new rule or collector doing its own I/O |
| 2   | Each glob pattern is issued **exactly once**                                                                      | Repeated directory traversal                                                     |
| 3   | Reads of a shared layout / shared `$lib` component **do not vary with route count** (2-route vs 12-route fixture) | Parse-cache breakage — the primary case                                          |
| 4   | With `route` set, the file-scoped globs (component, kit-module, source-file inventory) are **not issued**         | Loss of the single-route fast path                                               |

The budget covers **`collectAll` only**. Validation reads in `analyzeProject`
(`detectProject` and `checkVersionFloor` both read `package.json`) sit outside it
by design — they are per-run constants, not per-file work that scales.

Invariant 1's limit of 2 is the **measured status quo for `.svelte` files, not an
ideal**. The test comments record why (separate parsers, separate caches) and the
rule for changing it: lowering the budget is welcome and should accompany any
unification of the two read paths; raising it is a design decision that needs
justification, not a number edit. `collectProjectFacts`'s config-file reads
(`svelte.config.*`, `vite.config.*`) were not part of the probe above; if
implementation finds one legitimately exceeds 2, it is recorded as a named
exception with its reason rather than by raising the global limit.

Assertions collect the offenders rather than asserting per entry, so a failure
names the culprits directly:

```ts
const over = [...counts.readFile].filter(([, n]) => n > MAX_READS_PER_FILE);
expect(over).toEqual([]);
```

### 4. Promote the timing benchmark to a manual tool

- Register `bench` in `packages/vite/package.json` (`node scripts/bench/bench.mjs`)
  and at the root, so `pnpm bench` works.
- Rewrite the headers of `bench.mjs` and `gen-project.mjs`: drop `Throwaway` and
  `disposable once the design doc is written`; state that it is a manual
  measurement tool, that CI deliberately does not run it (shared-runner noise
  makes cross-run comparison meaningless), and that it is the tool to reach for
  when a change is suspected of widening analysis or losing parallelism.
- Measurement logic and JSON output are unchanged.

### 5. Documentation

Add an "I/O budget" note to `AGENTS.md`: adding a collector or a glob means
checking `io-budget.test.ts`, and raising a budget is a design decision.

## Testing

The budget tests _are_ the deliverable, so the verification that matters is that
they fail when they should. Before landing, each invariant is confirmed to catch
its target by temporarily breaking the corresponding behaviour (bypassing the
`ParseCache`, issuing a glob twice) and observing a red test with a useful
message. `pnpm lint`, `pnpm typecheck`, and `pnpm test` must all pass, and the
`collect-all.ts` extraction must leave the existing CLI test suite green —
it is a pure move, so any behavioural diff is a bug in the extraction.

## Out of scope

- Any timing assertion in CI.
- Counting AST walk volume (would require instrumenting core, which the
  `Runtime` seam does not cover).
- Unifying the two `.svelte` read paths to lower the budget from 2 to 1. The
  budget makes that work measurable; doing it is separate.
- Consolidating core's duplicated `createMemoryRuntime` helpers.
