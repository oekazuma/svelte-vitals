// Throwaway benchmark for Plan 037 (dev-server analysis isolation spike,
// docs/superpowers/plans/037-design-spike-dev-server-analysis-isolation.md).
// Not part of the shipped package — do not import from packages/vite/src. No tests:
// this is a one-off measurement tool whose results are transcribed into
// docs/superpowers/specs/2026-07-13-dev-server-analysis-isolation-design.md.
//
// Measures, for synthetic SvelteKit-like projects of increasing route count, how long
// a single whole-project `analyzeProject()` call takes (the same call
// packages/vite/src/ui/analysis.ts's `runOnce` makes on every dev-server save) and how
// much it blocks the Node event loop while it runs, using two independent methods:
//
//   1. perf_hooks.monitorEventLoopDelay — a fresh Histogram per run, enabled right
//      before the analyze() call and disabled right after, read in ms.
//   2. The classic tick-drift method: a setInterval firing every TICK_MS, recording
//      the actual gap between ticks. A busy/blocked event loop shows up as gaps much
//      larger than TICK_MS. We report the max gap and the cumulative time spent in
//      gaps beyond BLOCK_THRESHOLD_MS (the plan's suggested "distinctly blocked"
//      cutoff), which double-checks the perf_hooks numbers without relying solely on
//      one API.
//
// Usage: node packages/vite/scripts/bench/bench.mjs [--sizes=50,200,500] [--runs=3]

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { analyzeProject } from 'svelte-vitals';
import { generateProject } from './gen-project.mjs';

const TICK_MS = 10;
const BLOCK_THRESHOLD_MS = 100;

function parseArgs(argv) {
  const opts = { sizes: [50, 200, 500], runs: 3 };
  for (const arg of argv) {
    if (arg.startsWith('--sizes=')) {
      opts.sizes = arg
        .slice('--sizes='.length)
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
    } else if (arg.startsWith('--runs=')) {
      opts.runs = Number(arg.slice('--runs='.length));
    }
  }
  return opts;
}

function startTickMonitor(intervalMs) {
  const gaps = [];
  let last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    gaps.push(now - last);
    last = now;
  }, intervalMs);
  return {
    stop() {
      clearInterval(timer);
      return gaps;
    }
  };
}

function summarizeTicks(gaps, thresholdMs) {
  let maxGapMs = 0;
  let excessMs = 0;
  let blockedTicks = 0;
  for (const gap of gaps) {
    if (gap > maxGapMs) maxGapMs = gap;
    if (gap > thresholdMs) {
      excessMs += gap - TICK_MS;
      blockedTicks++;
    }
  }
  return { maxGapMs, excessMs, blockedTicks, totalTicks: gaps.length };
}

function nsToMs(ns) {
  return ns / 1e6;
}

async function measureOnce(cwd) {
  const histogram = monitorEventLoopDelay({ resolution: 5 });
  histogram.enable();
  const ticks = startTickMonitor(TICK_MS);

  const t0 = performance.now();
  const { results } = await analyzeProject({ cwd });
  const t1 = performance.now();

  histogram.disable();
  const gaps = ticks.stop();

  const eld = {
    minMs: nsToMs(histogram.min),
    maxMs: nsToMs(histogram.max),
    meanMs: nsToMs(histogram.mean),
    p50Ms: nsToMs(histogram.percentile(50)),
    p99Ms: nsToMs(histogram.percentile(99))
  };
  const tick = summarizeTicks(gaps, BLOCK_THRESHOLD_MS);

  return { totalMs: t1 - t0, resultCount: results.length, eld, tick };
}

async function main() {
  const { sizes, runs } = parseArgs(process.argv.slice(2));
  console.log(
    `svelte-vitals dev-dashboard analysis benchmark — node ${process.version}, ${runs} timed run(s) per size (+1 discarded warmup), tick interval ${TICK_MS}ms, block threshold ${BLOCK_THRESHOLD_MS}ms\n`
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
            `tick(maxGap=${m.tick.maxGapMs.toFixed(1)}ms blockedTicks=${m.tick.blockedTicks}/${m.tick.totalTicks} excess=${m.tick.excessMs.toFixed(1)}ms) ` +
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
