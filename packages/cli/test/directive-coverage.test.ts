import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@svelte-vitals/core';
import { allRules, isPenalized, runRules, selectRules } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createNodeRuntime } from '../src/runtime/node.js';

// The inline directive's whole claim is that it covers every line-anchored finding *by
// construction*, with no per-rule wiring to forget. That holds only while every file a
// line-anchored finding can name is a file the run scanned for directives — and the index
// records every scanned file, so membership answers exactly that. Run against the real
// gallery, this fails the moment a rule starts anchoring findings into a file no collector
// reads for directives, which is how `performance/minify-disabled` (vite.config) was found.
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'examples', 'kitchen-sink');

describe('inline directive coverage', () => {
  it('scans every file a line-anchored finding points at', { timeout: 60_000 }, async () => {
    const rt = createNodeRuntime();
    // Deliberately the default config, not the example's own: loading that `.ts` file through
    // vitest's transform needs `.svelte-kit/tsconfig.json`, which only `svelte-kit sync` creates and
    // this package's test script does not run. The gap that leaves is narrow — the example's config
    // only wakes option-gated rules, and every one of them is `componentRule`-family, so its
    // findings anchor into files the component collector already enters in the index.
    const config = defineConfig({});
    const facts = await collectAll(rt, appDir, config);
    const { results } = await runRules(selectRules(allRules, config), { ...facts, config });
    const anchored = results.filter(
      (r) => r.location !== undefined && (r.line ?? 0) > 0 && isPenalized(r.detection, config.treatDynamicAs)
    );
    expect(anchored.length).toBeGreaterThan(20);
    const unreachable = [
      ...new Set(anchored.filter((r) => !facts.directives.has(r.location!)).map((r) => r.location!))
    ];
    expect(unreachable).toEqual([]);
  });
});
