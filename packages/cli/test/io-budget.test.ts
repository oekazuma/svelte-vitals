import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';
import { createCountingRuntime, type RuntimeCounts } from './helpers/counting-runtime.js';

/**
 * Reads per file allowed across one full collection phase. TWO is the measured
 * status quo, not an ideal. Two independent paths sit at exactly this cap:
 *
 *   - every `.svelte` file: `collectRoutes` reads it for head resolution
 *     (parseFile) and `collectComponentFacts` reads it again for component facts
 *     (parseComponentFacts) — different parsers, separate caches, and the
 *     component glob also matches route files.
 *   - the Vite config: `collectProjectFacts` reads it once via
 *     `detectViteMinifyDisabled` and once via `detectKitConfigFacts`.
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
 *
 * Also includes one kit-module file of each shape `collectKitModuleFacts` looks
 * for (a hooks file and a route `+page.server.ts`) so that collector's globs and
 * reads fall under the budget too, instead of running unbudgeted against a
 * fixture with nothing for it to find.
 */
function project(routeCount: number): Record<string, string> {
  const files: Record<string, string> = {
    'svelte.config.js': `export default { kit: {} };\n`,
    'vite.config.ts': `export default { plugins: [] };\n`,
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>\n`,
    'src/routes/+layout.svelte': `<script>\n  import Card from '$lib/Card.svelte';\n  let { children } = $props();\n</script>\n\n<Card title="shared" />\n{@render children()}\n`,
    'src/lib/Card.svelte': `<script>\n  let { title = '' } = $props();\n</script>\n\n<svelte:head><meta name="description" content="shared" /></svelte:head>\n<h3>{title}</h3>\n`,
    'src/hooks.server.ts': `export async function handle({ event, resolve }) {\n  return resolve(event);\n}\n`,
    'src/routes/p0/+page.server.ts': `export async function load() {\n  return {};\n}\n`
  };
  for (let i = 0; i < routeCount; i++) {
    files[`src/routes/p${i}/+page.svelte`] =
      `<svelte:head><title>Page ${i}</title></svelte:head>\n<h1>Page ${i}</h1>\n`;
  }
  return files;
}

/**
 * Files read more than the budget allows. Returned as `[path, count]` pairs rather
 * than asserted per entry so a failure names every offender and by how much.
 */
function overReadBudget(counts: RuntimeCounts): [string, number][] {
  return [...counts.readFile].filter(([, n]) => n > MAX_READS_PER_FILE);
}

/** Glob patterns issued more than once — each repeat is another full directory traversal. */
function repeatedGlobs(counts: RuntimeCounts): [string, number][] {
  return [...counts.glob].filter(([, n]) => n !== 1);
}

describe('I/O budget for the collection phase', () => {
  it(`reads no file more than ${MAX_READS_PER_FILE} times`, async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    expect(overReadBudget(counts)).toEqual([]);
  });

  it('issues each glob pattern exactly once', async () => {
    const { rt, counts } = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(rt, '', defaultConfig);

    expect(repeatedGlobs(counts)).toEqual([]);
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
      // Guard against a vacuous pass: Map#get returns undefined for a file that was
      // never read at all, and undefined === undefined would satisfy the equality
      // below just as well as a real match would.
      expect(small.counts.readFile.get(shared)).toBeGreaterThan(0);
      expect([shared, large.counts.readFile.get(shared)]).toEqual([shared, small.counts.readFile.get(shared)]);
    }
  });

  it('scans no components or kit modules for a route-filtered run', async () => {
    const full = createCountingRuntime(createMemoryRuntime(project(6)));
    const filtered = createCountingRuntime(createMemoryRuntime(project(6)));

    await collectAll(full.rt, '', defaultConfig);
    await collectAll(filtered.rt, '', defaultConfig, { route: 'p0' });

    // Derived-set comparison rather than pinned string literals: this fails both if
    // a pattern that should be skipped starts being issued anyway, and if a pattern
    // gets reworded (the string literals below would then no longer match anything
    // in `full`, so the two runs would look identical and this would go red rather
    // than passing vacuously).
    const skipped = [...full.counts.glob.keys()].filter((p) => !filtered.counts.glob.has(p));
    // The source-file inventory, component scanning, and every kit-module glob
    // (page/layout, their .server variants, +server endpoints, and hooks.server) —
    // the whole file-scoped-facts surface that a route-filtered run has no use for.
    expect(skipped.sort()).toEqual([
      'src/**/*',
      'src/**/*.svelte{,.ts,.js}',
      'src/hooks.server.{ts,js}',
      'src/routes/**/+server.{ts,js}',
      'src/routes/**/+{page,layout}.server.{ts,js}',
      'src/routes/**/+{page,layout}.{ts,js}'
    ]);

    // The filtered run is held to the same count budgets as the unfiltered one. The
    // set comparison above proves only WHICH patterns were issued, never how many
    // times, and the two invariants that do count never exercise this path — so
    // without these two lines a regression confined to the `--route` path (say a
    // glob moved inside a per-route loop) would stay green in every check here.
    expect(overReadBudget(filtered.counts)).toEqual([]);
    expect(repeatedGlobs(filtered.counts)).toEqual([]);
  });
});
