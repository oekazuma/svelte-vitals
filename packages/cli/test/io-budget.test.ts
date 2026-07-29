import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';
import { createCountingRuntime } from './helpers/counting-runtime.js';

/**
 * Reads per file allowed across one full collection phase. TWO is the measured
 * status quo, not an ideal. Two independent paths sit at exactly this cap:
 *
 *   - every `.svelte` file: `collectRoutes` reads it for head resolution
 *     (parseFile) and `collectComponentFacts` reads it again for component facts
 *     (parseComponentFacts) — different parsers, separate caches, and the
 *     component glob also matches route files.
 *   - the Vite config: `collectProjectFacts` reads it once via
 *     `detectViteMinifyDisabled` and once via `detectKitPathsBase`.
 *
 * Lowering this number is welcome and should accompany any unification of those
 * read paths. RAISING it is a design decision that needs a recorded reason — not a
 * number edit. See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
const MAX_READS_PER_FILE = 2;

/**
 * A SvelteKit-shaped project as a path→source map: `routeCount` pages that all
 * inherit one root layout, which itself pulls in one shared $lib component. The
 * sharing is the point — it is what a broken parse cache would read repeatedly.
 */
function project(routeCount: number): Record<string, string> {
  const files: Record<string, string> = {
    'svelte.config.js': `export default { kit: {} };\n`,
    'vite.config.ts': `export default { plugins: [] };\n`,
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>\n`,
    'src/routes/+layout.svelte': `<script>\n  import Card from '$lib/Card.svelte';\n  let { children } = $props();\n</script>\n\n<Card title="shared" />\n{@render children()}\n`,
    'src/lib/Card.svelte': `<script>\n  let { title = '' } = $props();\n</script>\n\n<svelte:head><meta name="description" content="shared" /></svelte:head>\n<h3>{title}</h3>\n`
  };
  for (let i = 0; i < routeCount; i++) {
    files[`src/routes/p${i}/+page.svelte`] =
      `<svelte:head><title>Page ${i}</title></svelte:head>\n<h1>Page ${i}</h1>\n`;
  }
  return files;
}

describe('I/O budget for the collection phase', () => {
  it(`reads no file more than ${MAX_READS_PER_FILE} times`, async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    // Collect the offenders rather than asserting per entry, so a failure names
    // every file that blew the budget and by how much.
    const over = [...counts.readFile].filter(([, n]) => n > MAX_READS_PER_FILE);
    expect(over).toEqual([]);
  });

  it('issues each glob pattern exactly once', async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    // A second call for the same pattern is a second full directory traversal.
    const repeated = [...counts.glob].filter(([, n]) => n !== 1);
    expect(repeated).toEqual([]);
    // Sanity: the run really did glob (an empty map would pass the check above).
    expect(counts.glob.size).toBeGreaterThan(0);
  });

  it('does not read shared files more often as route count grows', async () => {
    const small = createCountingRuntime(createMemoryRuntime(project(2)));
    const large = createCountingRuntime(createMemoryRuntime(project(12)));

    await collectAll(small.rt, '', defaultConfig);
    await collectAll(large.rt, '', defaultConfig);

    // 6x the routes must not mean more reads of the files they share. This is the
    // primary parse-cache-breakage detector: per-file budgets alone stay green if
    // the cache dies but every file happens to stay under the cap.
    for (const shared of ['src/routes/+layout.svelte', 'src/lib/Card.svelte']) {
      expect([shared, large.counts.readFile.get(shared)]).toEqual([shared, small.counts.readFile.get(shared)]);
    }
  });

  it('scans no components or kit modules for a route-filtered run', async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig, { route: 'p0' });

    // File-scoped facts are skipped when a single route was asked for; issuing
    // their globs anyway would pay for a whole-project scan nobody reads.
    const patterns = [...counts.glob.keys()];
    expect(patterns).not.toContain('src/**/*.svelte{,.ts,.js}');
    expect(patterns.filter((p) => p.includes('+{page,layout}') || p.includes('hooks.server'))).toEqual([]);
  });
});
