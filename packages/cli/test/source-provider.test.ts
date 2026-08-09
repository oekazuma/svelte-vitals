import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  seoSingleH1,
  seoTitlePresence,
  type Config,
  type Detection,
  type HeadTag,
  type ImageInfo,
  type ResolvedHead,
  type Runtime,
  defaultConfig,
  defaultProject,
  defineConfig
} from '@svelte-vitals/core';
import { createNodeRuntime } from '../src/runtime/node.js';
import { collectRoutes } from '../src/providers/source/routes.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'basic-project');

/** The head half of static-mode collection — what the deleted sourceHeadProvider wrapped. */
async function collectHeads(rt: Runtime, cwd: string, config?: Config): Promise<ResolvedHead[]> {
  return (await collectRoutes(rt, cwd, config)).heads;
}

function titleDetection(head: ResolvedHead): Detection {
  const title = head.tags.find((t) => t.kind === 'title');
  return title ? { presence: title.presence, value: title.value } : { presence: 'none', value: 'absent' };
}

describe('SourceHeadProvider (Node runtime, real fixture)', () => {
  it('resolves title detection per route across the layout chain', async () => {
    const rt = createNodeRuntime();
    const heads = await collectHeads(rt, fixtureDir);
    const byRoute = new Map(heads.map((h) => [h.route, h]));

    expect([...byRoute.keys()].sort()).toEqual([
      '/blog',
      '/dynamic',
      '/img',
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

  it('feeds seo/title-presence to produce one critical failure (the missing title)', async () => {
    const rt = createNodeRuntime();
    const heads = await collectHeads(rt, fixtureDir);
    const results = await seoTitlePresence.check({ heads, project: defaultProject, config: defineConfig({}) });
    const failing = results.filter((r) => r.detection.presence === 'none');
    expect(failing).toHaveLength(2);
    expect(failing.map((r) => r.route).sort()).toEqual(['/none', '/widget']);
  });

  it('detects svelte-meta-tags openGraph/twitter/JsonLd tags on the /smt route (issue #91)', async () => {
    const rt = createNodeRuntime();
    const heads = await collectHeads(rt, fixtureDir);
    const smt = new Map(heads.map((h) => [h.route, h])).get('/smt')!;
    const has = (pred: (t: HeadTag) => boolean) => smt.tags.some(pred);
    expect(has((t) => t.kind === 'meta' && t.property === 'og:url')).toBe(true);
    expect(has((t) => t.kind === 'meta' && t.property === 'og:description')).toBe(true);
    expect(has((t) => t.kind === 'meta' && t.name === 'twitter:card')).toBe(true);
    expect(has((t) => t.kind === 'jsonld')).toBe(true);
  });
});

describe('SourceHeadProvider (in-memory runtime)', () => {
  it('runs with no real files and detects dynamic titles', async () => {
    const rt = createMemoryRuntime({
      'src/routes/static/+page.svelte': '<svelte:head><title>Hi</title></svelte:head>',
      'src/routes/dynamic/+page.svelte': '<svelte:head><title>{data.title}</title></svelte:head>'
    });
    const heads = await collectHeads(rt, '');
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
    const [head] = await collectHeads(rt, '', defaultConfig);
    expect(titleDetection(head!)).toEqual({ presence: 'own', value: 'dynamic' });
  });

  it('keeps a missing title as none when only an unknown component is present', async () => {
    const rt = createMemoryRuntime({
      'src/routes/page/+page.svelte': `<script>import Button from '$lib/Button.svelte';</script><Button />`,
      'src/lib/Button.svelte': `<button>x</button>`
    });
    const [head] = await collectHeads(rt, '', defaultConfig);
    expect(titleDetection(head!)).toEqual({ presence: 'none', value: 'absent' });
  });

  it('suppresses missing title for a metaComponents-declared component', async () => {
    const rt = createMemoryRuntime({
      'src/routes/page/+page.svelte': `<Widget />`
    });
    const config = defineConfig({ metaComponents: ['Widget'] });
    const [head] = await collectHeads(rt, '', config);
    expect(titleDetection(head!)).toEqual({ presence: 'own', value: 'dynamic' });
  });
});

describe('collectRoutes image collection (in-memory runtime)', () => {
  it('collects images from layout and page per route', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': '<img src="/logo.png" width="100" height="100" loading="lazy" />',
      'src/routes/blog/+page.svelte': '<img src="/hero.png" />'
    });
    const { images: resolved } = await collectRoutes(rt, '');
    const byRoute = new Map(resolved.map((r) => [r.route, r]));
    const blog = byRoute.get('/blog')!;
    expect(blog).toBeDefined();
    // layout image (with all attrs) + page image (missing attrs)
    expect(blog.images).toHaveLength(2);
    const layoutImg = blog.images.find((i: ImageInfo) => i.file === 'src/routes/+layout.svelte');
    expect(layoutImg).toMatchObject({ hasWidth: true, hasHeight: true, hasLoading: true });
    const pageImg = blog.images.find((i: ImageInfo) => i.file === 'src/routes/blog/+page.svelte');
    expect(pageImg).toMatchObject({ hasWidth: false, hasHeight: false, hasLoading: false });
  });
});

describe('collectRoutes (single-pass heads + images)', () => {
  it('returns heads and images for the same routes from one collection', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': '<svelte:head><title>Home</title></svelte:head>',
      'src/routes/blog/+page.svelte': '<img src="/hero.png" />'
    });
    const { heads, images } = await collectRoutes(rt, '');
    expect(heads.map((h) => h.route).sort()).toEqual(['/', '/blog']);
    expect(images.map((i) => i.route).sort()).toEqual(['/', '/blog']);

    // The image-bearing route exposes its <img>; the image-less route is empty.
    const byRoute = new Map(images.map((i) => [i.route, i]));
    expect(byRoute.get('/blog')!.images).toHaveLength(1);
    expect(byRoute.get('/')!.images).toHaveLength(0);

    // Head composition is intact alongside image collection.
    const home = heads.find((h) => h.route === '/')!;
    expect(home.tags.some((t) => t.kind === 'title')).toBe(true);
  });
});

describe('collectRoutes componentHeadings (issue #425)', () => {
  it('lets seo/single-h1 see an <h1> rendered by an imported child component', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<script>import SiteHeader from '$lib/SiteHeader.svelte';</script><SiteHeader />`,
      'src/lib/SiteHeader.svelte': `<h1>Welcome</h1>`
    });
    const { headings } = await collectRoutes(rt, '');
    const route = headings.find((h) => h.route === '/')!;
    // No <h1> in the chain files themselves — it lives only in the child component.
    expect(route.headings).toEqual([]);
    expect(route.componentHeadings).toEqual([
      { level: 1, line: expect.any(Number), file: 'src/lib/SiteHeader.svelte' }
    ]);

    const results = await seoSingleH1.check({ heads: [], headings, project: defaultProject, config: defaultConfig });
    expect(results.map((r) => r.message)).not.toContain('Missing <h1>');
  });

  it('keeps componentHeadings separate from the chain-file headings array (no double count)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<script>import Card from '$lib/Card.svelte';</script><h2>Layout</h2><Card /><slot />`,
      'src/routes/+page.svelte': `<h3>Page</h3>`,
      'src/lib/Card.svelte': `<h1>Card</h1>`
    });
    const { headings } = await collectRoutes(rt, '');
    const route = headings.find((h) => h.route === '/')!;
    // Chain-file `headings` must stay component-free — it is seo/heading-level-skip's
    // document-order input.
    expect(route.headings).toEqual([
      { level: 2, line: expect.any(Number), file: 'src/routes/+layout.svelte' },
      { level: 3, line: expect.any(Number), file: 'src/routes/+page.svelte' }
    ]);
    expect(route.componentHeadings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/lib/Card.svelte' }]);
  });
});

describe('SourceHeadProvider real fixtures (component detection)', () => {
  it('resolves component-based titles across the project', async () => {
    const rt = createNodeRuntime();
    const heads = await collectHeads(rt, fixtureDir, defaultConfig);
    const byRoute = new Map(heads.map((h) => [h.route, h]));

    expect(titleDetection(byRoute.get('/smt')!)).toEqual({ presence: 'own', value: 'dynamic' });
    expect(titleDetection(byRoute.get('/smt-spread')!)).toEqual({ presence: 'own', value: 'dynamic' });
    expect(titleDetection(byRoute.get('/wrapper')!)).toEqual({ presence: 'own', value: 'dynamic' });
    // /none and /widget have no meta source -> still none.
    expect(titleDetection(byRoute.get('/none')!)).toEqual({ presence: 'none', value: 'absent' });
  });
});
