// Manual timing benchmark for the whole-project analysis path — the same
// `analyzeProject()` call packages/vite/src/ui/analysis.ts's `runOnce` makes on
// every dev-server save. Run it with `pnpm bench`.
//
// CI deliberately does NOT run this. Shared GitHub runners vary by 1.5-2x under
// neighbour load, so absolute timings are not comparable across runs; the speed
// regression gate CI *does* run is the deterministic I/O budget in
// packages/cli/test/io-budget.test.ts. Reach for this benchmark for the two things
// call counts cannot catch: a widened analysis (more AST walking for the same I/O)
// and lost parallelism. See
// docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
//
// Not part of the shipped package — do not import from packages/vite/src.
//
// Measures, for synthetic SvelteKit-like projects of increasing route count, how long
// a single whole-project `analyzeProject()` call takes (the same call
// packages/vite/src/ui/analysis.ts's `runOnce` makes on every dev-server save) and how
// much it blocks the Node event loop while it runs, via perf_hooks.monitorEventLoopDelay —
// a fresh Histogram per run, enabled right before the analyze() call and disabled right
// after, read in ms.
//
// Usage: node packages/vite/scripts/bench/bench.mjs [--sizes=50,200,500] [--runs=3]

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { analyzeProject } from 'svelte-vitals';
import { generateProject } from './gen-project.mjs';

function parseBenchArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: { sizes: { type: 'string' }, runs: { type: 'string' } }
  });
  const runs = values.runs === undefined ? 3 : Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    throw new Error(`--runs must be a positive integer, got '${values.runs}'`);
  }
  return {
    sizes: values.sizes
      ?.split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n > 0) ?? [50, 200, 500],
    runs
  };
}

function nsToMs(ns) {
  return ns / 1e6;
}

async function measureOnce(cwd) {
  const histogram = monitorEventLoopDelay({ resolution: 5 });
  histogram.enable();

  const t0 = performance.now();
  const { results } = await analyzeProject({ cwd });
  const t1 = performance.now();

  histogram.disable();

  const eld = {
    minMs: nsToMs(histogram.min),
    maxMs: nsToMs(histogram.max),
    meanMs: nsToMs(histogram.mean),
    p50Ms: nsToMs(histogram.percentile(50)),
    p99Ms: nsToMs(histogram.percentile(99))
  };

  return { totalMs: t1 - t0, resultCount: results.length, eld };
}

async function main() {
  const { sizes, runs } = parseBenchArgs(process.argv.slice(2));
  console.log(
    `svelte-vitals dev-dashboard analysis benchmark — node ${process.version}, ${runs} timed run(s) per size (+1 discarded warmup)\n`
  );

  const allResults = [];

  for (const routeCount of sizes) {
    const dir = mkdtempSync(join(tmpdir(), `svelte-vitals-bench-${routeCount}-`));
    try {
      generateProject(dir, routeCount);

      // Discarded warmup run: primes the OS file cache and any V8 JIT warmup so the
      // timed runs reflect steady-state cost, not first-touch disk I/O.
      await measureOnce(dir);

      const runsData = [];
      for (let i = 0; i < runs; i++) {
        const m = await measureOnce(dir);
        runsData.push(m);
        console.log(
          `routes=${routeCount} run=${i + 1}/${runs} total=${m.totalMs.toFixed(1)}ms ` +
            `eld(max=${m.eld.maxMs.toFixed(1)}ms p99=${m.eld.p99Ms.toFixed(1)}ms mean=${m.eld.meanMs.toFixed(2)}ms) ` +
            `results=${m.resultCount}`
        );
      }
      allResults.push({ routeCount, runs: runsData });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log('\n--- JSON ---');
  console.log(JSON.stringify(allResults, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
