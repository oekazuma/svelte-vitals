import type { Runtime } from '@svelte-vitals/core/internal';

/**
 * Call counts keyed by path (readFile/exists) or by pattern (glob).
 *
 * `exists` is captured for completeness but no io-budget invariant currently
 * asserts on it — the design doc doesn't budget it either. That's a deliberate
 * gap, not an oversight; add an invariant deliberately if that changes rather
 * than assuming the omission was accidental.
 */
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
export function createCountingRuntime(base: Runtime) {
  const counts: RuntimeCounts = { readFile: new Map(), exists: new Map(), glob: new Map() };
  const bump = (m: Map<string, number>, key: string) => m.set(key, (m.get(key) ?? 0) + 1);
  const rt: Runtime = {
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
  };
  return { rt, counts };
}
