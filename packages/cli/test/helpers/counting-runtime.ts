import type { Runtime } from '@svelte-vitals/core';

/** Call counts keyed by path (readFile/exists) or by pattern (glob). */
export interface RuntimeCounts {
  readFile: Map<string, number>;
  exists: Map<string, number>;
  glob: Map<string, number>;
}

/**
 * Wrap a Runtime so every call through it is counted. These counts are what
 * `test/io-budget.test.ts` holds the analysis pipeline to: unlike wall-clock
 * timings they are identical on every machine, so the gate cannot be flaky.
 * See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
export function createCountingRuntime(base: Runtime): { rt: Runtime; counts: RuntimeCounts } {
  const counts: RuntimeCounts = { readFile: new Map(), exists: new Map(), glob: new Map() };
  const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);
  return {
    counts,
    rt: {
      ...base,
      readFile(path) {
        bump(counts.readFile, path);
        return base.readFile(path);
      },
      exists(path) {
        bump(counts.exists, path);
        return base.exists(path);
      },
      glob(pattern, cwd) {
        bump(counts.glob, pattern);
        return base.glob(pattern, cwd);
      }
    }
  };
}
