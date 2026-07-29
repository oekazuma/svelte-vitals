import { describe, it, expect } from 'vitest';
import { collectRoutes } from '../src/providers/source/routes.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';
import { createCountingRuntime } from './helpers/counting-runtime.js';

describe('parse cache (per-run readFile dedup)', () => {
  it('reads a shared root layout and a shared $lib component exactly once across routes', async () => {
    const base = createMemoryRuntime({
      'src/routes/+layout.svelte': `<script>import Seo from '$lib/Seo.svelte';</script><Seo /><img src="/logo.png" />`,
      'src/routes/a/+page.svelte': `<h1>A</h1>`,
      'src/routes/b/+page.svelte': `<h1>B</h1>`,
      'src/lib/Seo.svelte': `<svelte:head><title>{data.title}</title><meta name="description" content={data.desc} /></svelte:head>`
    });
    const { rt, counts } = createCountingRuntime(base);

    const { heads, images, headings } = await collectRoutes(rt, '');

    // Root layout and the shared component are each on both routes' chains, but
    // must be read+parsed exactly once for the whole run.
    expect(counts.readFile.get('src/routes/+layout.svelte')).toBe(1);
    expect(counts.readFile.get('src/lib/Seo.svelte')).toBe(1);
    // Each page is still read once (never merged across distinct route files).
    expect(counts.readFile.get('src/routes/a/+page.svelte')).toBe(1);
    expect(counts.readFile.get('src/routes/b/+page.svelte')).toBe(1);

    // Output is unaffected by caching: both routes see the composed title/description
    // (inherited from the layout's Seo usage) and the layout's <img>/page's <h1>.
    const byRoute = new Map(heads.map((h) => [h.route, h]));
    for (const route of ['/a', '/b']) {
      const head = byRoute.get(route)!;
      expect(head.tags).toContainEqual({
        kind: 'title',
        value: 'dynamic',
        presence: 'inherited',
        file: 'src/routes/+layout.svelte'
      });
      expect(head.tags.some((t) => t.kind === 'meta' && t.name === 'description' && t.presence === 'inherited')).toBe(
        true
      );
    }

    const imagesByRoute = new Map(images.map((i) => [i.route, i]));
    expect(imagesByRoute.get('/a')!.images).toHaveLength(1);
    expect(imagesByRoute.get('/a')!.images[0]).toMatchObject({ file: 'src/routes/+layout.svelte' });
    expect(imagesByRoute.get('/b')!.images).toHaveLength(1);

    const headingsByRoute = new Map(headings.map((h) => [h.route, h]));
    expect(headingsByRoute.get('/a')!.headings).toEqual([
      { level: 1, line: expect.any(Number), file: 'src/routes/a/+page.svelte' }
    ]);
    expect(headingsByRoute.get('/b')!.headings).toEqual([
      { level: 1, line: expect.any(Number), file: 'src/routes/b/+page.svelte' }
    ]);
  });
});
