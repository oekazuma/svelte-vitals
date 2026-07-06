import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  seo001Title,
  type Detection,
  type HeadTag,
  type ImageInfo,
  type ResolvedHead,
  defaultConfig,
  defaultProject,
  defineConfig
} from '@svelte-vitals/core';
import { createNodeRuntime } from '../src/runtime/node.js';
import { collectRoutes, sourceHeadProvider } from '../src/providers/source/routes.js';
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

  it('feeds SEO001 to produce one critical failure (the missing title)', async () => {
    const rt = createNodeRuntime();
    const heads = await sourceHeadProvider.collect(rt, fixtureDir);
    const results = await seo001Title.check({ heads, project: defaultProject, config: defineConfig({}) });
    const failing = results.filter((r) => r.detection.presence === 'none');
    expect(failing).toHaveLength(2);
    expect(failing.map((r) => r.route).sort()).toEqual(['/none', '/widget']);
  });

  it('detects svelte-meta-tags openGraph/twitter/JsonLd tags on the /smt route (issue #91)', async () => {
    const rt = createNodeRuntime();
    const heads = await sourceHeadProvider.collect(rt, fixtureDir);
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
