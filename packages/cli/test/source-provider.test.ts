import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { seo001Title, type Detection, type ResolvedHead, defaultConfig, defineConfig } from '@svelte-vitals/core';
import { createNodeRuntime } from '../src/runtime/node.js';
import { sourceHeadProvider } from '../src/providers/source/routes.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic-project');

function titleDetection(head: ResolvedHead): Detection {
  const title = head.tags.find((t) => t.kind === 'title');
  return title ? { presence: title.presence, value: title.value } : { presence: 'none', value: 'absent' };
}

describe('SourceHeadProvider (Node runtime, real fixture)', () => {
  it('resolves title detection per route across the layout chain', async () => {
    const rt = createNodeRuntime();
    const heads = await sourceHeadProvider.collect(rt, fixtureDir);
    const byRoute = new Map(heads.map((h) => [h.route, h]));

    expect([...byRoute.keys()].sort()).toEqual([
      '/blog',
      '/dynamic',
      '/none',
      '/smt',
      '/smt-spread',
      '/static',
      '/widget',
      '/wrapper'
    ]);

    expect(titleDetection(byRoute.get('/static')!)).toEqual({ presence: 'own', value: 'static' });
    expect(titleDetection(byRoute.get('/dynamic')!)).toEqual({ presence: 'own', value: 'dynamic' });
    expect(titleDetection(byRoute.get('/none')!)).toEqual({ presence: 'none', value: 'absent' });
    // /blog has no own <title>; it inherits from blog/+layout.svelte.
    expect(titleDetection(byRoute.get('/blog')!)).toEqual({ presence: 'inherited', value: 'static' });
  });

  it('feeds SEO001 to produce one critical failure (the missing title)', async () => {
    const rt = createNodeRuntime();
    const heads = await sourceHeadProvider.collect(rt, fixtureDir);
    const results = await seo001Title.check({ heads, config: { treatDynamicAs: 'pass', metaComponents: [] } });
    const failing = results.filter((r) => r.detection.presence === 'none');
    expect(failing).toHaveLength(2);
    expect(failing.map((r) => r.route).sort()).toEqual(['/none', '/widget']);
  });
});

describe('SourceHeadProvider (in-memory runtime)', () => {
  it('runs with no real files and detects dynamic titles', async () => {
    const rt = createMemoryRuntime({
      'src/routes/static/+page.svelte': '<svelte:head><title>Hi</title></svelte:head>',
      'src/routes/dynamic/+page.svelte': '<svelte:head><title>{data.title}</title></svelte:head>'
    });
    const heads = await sourceHeadProvider.collect(rt, '');
    const byRoute = new Map(heads.map((h) => [h.route, h]));
    expect(titleDetection(byRoute.get('/static')!)).toEqual({ presence: 'own', value: 'static' });
    expect(titleDetection(byRoute.get('/dynamic')!)).toEqual({ presence: 'own', value: 'dynamic' });
  });
});

describe('SourceHeadProvider component detection (layers 2-4)', () => {
  it('resolves a MetaTags title via the in-memory runtime', async () => {
    const rt = createMemoryRuntime({
      'src/routes/page/+page.svelte': `<script>import { MetaTags } from 'svelte-meta-tags';</script><MetaTags title={data.title} />`
    });
    const [head] = await sourceHeadProvider.collect(rt, '', defaultConfig);
    expect(titleDetection(head!)).toEqual({ presence: 'own', value: 'dynamic' });
  });

  it('keeps a missing title as none when only an unknown component is present', async () => {
    const rt = createMemoryRuntime({
      'src/routes/page/+page.svelte': `<script>import Button from '$lib/Button.svelte';</script><Button />`,
      'src/lib/Button.svelte': `<button>x</button>`
    });
    const [head] = await sourceHeadProvider.collect(rt, '', defaultConfig);
    expect(titleDetection(head!)).toEqual({ presence: 'none', value: 'absent' });
  });

  it('suppresses missing title for a metaComponents-declared component', async () => {
    const rt = createMemoryRuntime({
      'src/routes/page/+page.svelte': `<Widget />`
    });
    const config = defineConfig({ metaComponents: ['Widget'] });
    const [head] = await sourceHeadProvider.collect(rt, '', config);
    expect(titleDetection(head!)).toEqual({ presence: 'own', value: 'dynamic' });
  });
});

describe('SourceHeadProvider real fixtures (component detection)', () => {
  it('resolves component-based titles across the project', async () => {
    const rt = createNodeRuntime();
    const heads = await sourceHeadProvider.collect(rt, fixtureDir, defaultConfig);
    const byRoute = new Map(heads.map((h) => [h.route, h]));

    expect(titleDetection(byRoute.get('/smt')!)).toEqual({ presence: 'own', value: 'dynamic' });
    expect(titleDetection(byRoute.get('/smt-spread')!)).toEqual({ presence: 'own', value: 'dynamic' });
    expect(titleDetection(byRoute.get('/wrapper')!)).toEqual({ presence: 'own', value: 'dynamic' });
    // /none and /widget have no meta source -> still none.
    expect(titleDetection(byRoute.get('/none')!)).toEqual({ presence: 'none', value: 'absent' });
  });
});
