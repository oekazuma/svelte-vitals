import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { type Config, type Detection, defineConfig } from '@svelte-vitals/core';
import {
  performancePreconnect,
  performanceRenderBlockingScript,
  seoHreflang,
  seoHeadingLevelSkip,
  seoJsonLdValidity,
  seoSingleH1,
  seoTitlePresence,
  type HeadTag,
  type ImageInfo,
  type ResolvedHead,
  type Runtime,
  defaultConfig,
  defaultProject
} from '@svelte-vitals/core/internal';
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

describe('collectRoutes headings from <svelte:element> (issue #700)', () => {
  const headingsFor = async (page: string) => {
    const rt = createMemoryRuntime({ 'src/routes/+page.svelte': page });
    const { headings } = await collectRoutes(rt, '');
    return headings;
  };
  const check = async (headings: Awaited<ReturnType<typeof headingsFor>>) =>
    (await seoSingleH1.check({ heads: [], headings, project: defaultProject, config: defaultConfig })).map(
      (r) => r.message
    );

  it('reads a literal tag as the heading it resolves to', async () => {
    const headings = await headingsFor(`<main><svelte:element this={'h1'} class="sr-only">T</svelte:element></main>`);
    expect(headings[0]!.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/routes/+page.svelte' }]);
    expect(await check(headings)).toEqual(['Heading hierarchy']);
  });

  it('reads a conditional whose branches are literals, counting its one heading level', async () => {
    const headings = await headingsFor(`<svelte:element this={p === 1 ? 'h1' : 'span'}>Title</svelte:element>`);
    expect(headings[0]!.headings.map((h) => h.level)).toEqual([1]);
    expect(await check(headings)).toEqual(['Heading hierarchy']);
  });

  it('skips the route instead of reporting "Missing <h1>" when the tag is not determinable', async () => {
    const headings = await headingsFor('<svelte:element this={`h${level}`}>Title</svelte:element>');
    expect(headings[0]!.dynamicHeading).toBe(true);
    expect(await check(headings)).toEqual([]);
  });

  it('treats a conditional between two heading levels as undeterminable, not as either level', async () => {
    const headings = await headingsFor(`<svelte:element this={top ? 'h1' : 'h2'}>Title</svelte:element>`);
    expect(headings[0]!.headings).toEqual([]);
    expect(headings[0]!.dynamicHeading).toBe(true);
  });

  it('leaves a resolvable non-heading tag reporting the missing <h1> it really is', async () => {
    const headings = await headingsFor(`<svelte:element this={'span'}>Title</svelte:element>`);
    expect(headings[0]!.dynamicHeading).toBeUndefined();
    expect(await check(headings)).toEqual(['Missing <h1>']);
  });

  it('sees a dynamic heading inside a child component', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<script>import Heading from '$lib/Heading.svelte';</script><Heading />`,
      'src/lib/Heading.svelte': '<svelte:element this={`h${level}`}>T</svelte:element>'
    });
    const { headings } = await collectRoutes(rt, '');
    expect(headings[0]!.dynamicHeading).toBe(true);
    expect(await check(headings)).toEqual([]);
  });

  it('skips the route when an unresolvable component is given a literal heading tag', async () => {
    const headings = await headingsFor(
      `<script>import { Heading } from '@immich/ui';</script><Heading tag="h1" size="large">Welcome</Heading>`
    );
    expect(headings[0]!.dynamicHeading).toBe(true);
    expect(await check(headings)).toEqual([]);
  });

  it('still reports an unresolvable component whose element prop is not a literal h1', async () => {
    for (const usage of [
      '<Heading tag={level}>W</Heading>',
      '<Heading size="h1-ish">W</Heading>',
      '<Heading tag="h3">W</Heading>',
      '<Toggle value="h1">H1</Toggle>'
    ]) {
      const headings = await headingsFor(`<script>import { Heading } from '@immich/ui';</script>${usage}`);
      expect(headings[0]!.dynamicHeading).toBeUndefined();
      expect(await check(headings)).toEqual(['Missing <h1>']);
    }
  });

  it('follows a resolvable component instead of trusting its heading prop', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<script>import Heading from '$lib/Heading.svelte';</script><Heading tag="h1" />`,
      'src/lib/Heading.svelte': '<p>not a heading</p>'
    });
    const { headings } = await collectRoutes(rt, '');
    expect(headings[0]!.dynamicHeading).toBeUndefined();
    expect(await check(headings)).toEqual(['Missing <h1>']);
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

describe('collectRoutes: <h1>s in exclusive arms across files', () => {
  const singleH1 = async (files: Record<string, string>, route = '/') => {
    const { headings } = await collectRoutes(createMemoryRuntime(files), '');
    const rs = await seoSingleH1.check({
      heads: [],
      headings: headings.filter((h) => h.route === route),
      project: defaultProject,
      config: defaultConfig
    });
    return rs.map((r) => r.message);
  };
  const header = `<h1>Header</h1>`;

  it('counts a component in one {#if} arm against the <h1> of the other arm', async () => {
    const page = `<script>import Header from '$lib/Header.svelte';</script>{#if a}<h1>Own</h1>{:else}<Header />{/if}`;
    expect(await singleH1({ 'src/routes/+page.svelte': page, 'src/lib/Header.svelte': header })).toEqual([
      'Heading hierarchy'
    ]);
  });

  it('keeps each instance of a component its own block: one per arm renders once', async () => {
    const page = `<script>import Header from '$lib/Header.svelte';</script>{#if a}<Header />{:else}<div><Header /></div>{/if}`;
    expect(await singleH1({ 'src/routes/+page.svelte': page, 'src/lib/Header.svelte': header })).toEqual([
      'Heading hierarchy'
    ]);
  });

  it('counts a component in an {#await} arm against the <h1> of another arm', async () => {
    const page = `<script>import Header from '$lib/Header.svelte';</script>{#await p}<h1>Loading</h1>{:then}<Header />{/await}`;
    expect(await singleH1({ 'src/routes/+page.svelte': page, 'src/lib/Header.svelte': header })).toEqual([
      'Heading hierarchy'
    ]);
  });

  it('follows arms through nested components', async () => {
    const page = `<script>import View from '$lib/View.svelte';</script>{#if a}<h1>Own</h1>{:else}<View />{/if}`;
    const view = `<script>import Header from '$lib/Header.svelte';</script>{#if b}<Header />{:else}<h1>Other</h1>{/if}`;
    expect(
      await singleH1({ 'src/routes/+page.svelte': page, 'src/lib/View.svelte': view, 'src/lib/Header.svelte': header })
    ).toEqual(['Heading hierarchy']);
  });

  it('still adds up a component outside any arm and the page <h1>', async () => {
    const page = `<script>import Header from '$lib/Header.svelte';</script>{#if a}<h1>Own</h1>{/if}<Header />`;
    expect(await singleH1({ 'src/routes/+page.svelte': page, 'src/lib/Header.svelte': header })).toEqual([
      'Multiple <h1> (2); a single <h1> is the conventional signal'
    ]);
  });

  it("does not add a layout's <svelte:boundary> failed <h1> to the page's", async () => {
    const layout = `<svelte:boundary><slot />{#snippet failed(e)}<h1>Something went wrong</h1>{/snippet}</svelte:boundary>`;
    expect(await singleH1({ 'src/routes/+layout.svelte': layout, 'src/routes/+page.svelte': `<h1>Page</h1>` })).toEqual(
      ['Heading hierarchy']
    );
  });

  it('places the page inside the layout arm that renders {@render children()}', async () => {
    const layout = `{#if user}{@render children()}{:else}<h1>Sign in</h1>{/if}`;
    const files = { 'src/routes/+layout.svelte': layout, 'src/routes/+page.svelte': `<h3>Card</h3>` };
    const { headings } = await collectRoutes(createMemoryRuntime(files), '');
    const rs = await seoHeadingLevelSkip.check({ heads: [], headings, project: defaultProject, config: defaultConfig });
    expect(rs.map((r) => r.message)).toEqual(['Heading order']);
  });
});

describe('collectRoutes JSON-LD additivity (issue #443)', () => {
  it('keeps both application/ld+json scripts in one <svelte:head>, each feeding seo/json-ld-validity separately', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<svelte:head>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Site","url":"https://example.com"}</script>
  <script type="application/ld+json">{not valid json}</script>
</svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(head!.tags.filter((t) => t.kind === 'jsonld')).toHaveLength(2);

    const results = await seoJsonLdValidity.check({ heads: [head!], project: defaultProject, config: defaultConfig });
    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.detection.presence === 'own')).toHaveLength(1); // the valid WebSite document
    const finding = results.find((r) => r.detection.presence === 'none');
    expect(finding?.message).toBe('JSON-LD is not valid JSON');
  });

  it('keeps a layout jsonld tag (inherited) alongside a page jsonld tag (own)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Hi"}</script></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    const jsonldOnHead = head!.tags.filter((t) => t.kind === 'jsonld');
    expect(jsonldOnHead).toHaveLength(2);
    expect(jsonldOnHead.find((t) => t.file === 'src/routes/+layout.svelte')?.presence).toBe('inherited');
    expect(jsonldOnHead.find((t) => t.file === 'src/routes/+page.svelte')?.presence).toBe('own');
  });

  it('keeps a $lib component jsonld tag alongside the page own jsonld tag', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<script>import Seo from '$lib/Seo.svelte';</script><Seo /><svelte:head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Hi"}</script></svelte:head>`,
      'src/lib/Seo.svelte': `<svelte:head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(head!.tags.filter((t) => t.kind === 'jsonld')).toHaveLength(2);
  });

  it('still overrides the layout <title> with the page <title> (composed-path regression pin)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><title>Layout title</title></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><title>Page title</title></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(titleDetection(head!)).toEqual({ presence: 'own', value: 'static' });
    expect(head!.tags.filter((t) => t.kind === 'title')).toHaveLength(1);
  });

  it('overrides a layout rel="canonical" with a page rel="Canonical" (rel is case-insensitive)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><link rel="canonical" href="https://example.com/layout" /></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><link rel="Canonical" href="https://example.com/page" /></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    const canonicals = head!.tags.filter((t) => t.kind === 'link' && t.rel === 'canonical');
    expect(canonicals).toHaveLength(1);
    expect(canonicals[0]!.presence).toBe('own');
    expect(canonicals[0]!.href).toBe('https://example.com/page');
  });

  it('attributes a broken layout jsonld finding to the layout file, not the page', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><script type="application/ld+json">{not valid json}</script></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Hi"}</script></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    const results = await seoJsonLdValidity.check({ heads: [head!], project: defaultProject, config: defaultConfig });
    const finding = results.find((r) => r.message === 'JSON-LD is not valid JSON');
    expect(finding?.location).toBe('src/routes/+layout.svelte');
  });
});

describe('collectRoutes <link> additivity', () => {
  const links = (head: ResolvedHead, rel: string) => head.tags.filter((t) => t.kind === 'link' && t.rel === rel);

  it('keeps two <link rel="preload"> with different `as` in one <svelte:head>', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<svelte:head>
  <link rel="preload" href="/font.woff2" as="font" crossorigin />
  <link rel="preload" href="/app.css" as="style" />
</svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(links(head!, 'preload').map((t) => t.as)).toEqual(['font', 'style']);
  });

  it('keeps both Google Fonts preconnects so performance/preconnect reports no missing origin', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter" />
  <link rel="preload" href="https://fonts.gstatic.com/s/inter.woff2" as="font" crossorigin />
</svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(links(head!, 'preconnect')).toHaveLength(2);
    const results = await performancePreconnect.check({
      heads: [head!],
      project: defaultProject,
      config: defaultConfig
    });
    expect(results.map((r) => r.message)).toEqual(['Third-party origins are preconnected']);
  });

  it('keeps every hreflang alternate so seo/hreflang sees the full set', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<svelte:head>
  <link rel="alternate" hreflang="en" href="https://example.com/en" />
  <link rel="alternate" hreflang="ja" href="https://example.com/ja" />
</svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(links(head!, 'alternate').map((t) => t.hreflang)).toEqual(['en', 'ja']);
    const results = await seoHreflang.check({ heads: [head!], project: defaultProject, config: defaultConfig });
    expect(results.map((r) => r.message)).toEqual(['Multiple hreflang alternates with no x-default declared']);
  });

  it('keeps a layout preload (inherited) alongside a page preload (own)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><link rel="preload" href="/font.woff2" as="font" crossorigin /></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><link rel="preload" href="/hero.jpg" as="image" /></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    const preloads = links(head!, 'preload');
    expect(preloads).toHaveLength(2);
    expect(preloads.find((t) => t.file === 'src/routes/+layout.svelte')?.presence).toBe('inherited');
    expect(preloads.find((t) => t.file === 'src/routes/+page.svelte')?.presence).toBe('own');
  });
});

describe('collectRoutes <script src> additivity', () => {
  const scripts = (head: ResolvedHead) => head.tags.filter((t) => t.kind === 'script');

  it('keeps a layout blocking script alongside the page copy of the same src with defer', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><script src="https://cdn.example/x.js"></script></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><script src="https://cdn.example/x.js" defer></script></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(scripts(head!).map((t) => [t.file, t.presence, t.blocking ?? false])).toEqual([
      ['src/routes/+layout.svelte', 'inherited', true],
      ['src/routes/+page.svelte', 'own', false]
    ]);
    const results = await performanceRenderBlockingScript.check({
      heads: [head!],
      project: defaultProject,
      config: defaultConfig
    });
    expect(results.map((r) => [r.message, r.location])).toEqual([
      ['Render-blocking <script> (https://cdn.example/x.js) in <head>', 'src/routes/+layout.svelte']
    ]);
  });

  it('keeps two same-src scripts in one <svelte:head>', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<svelte:head>
  <script src="/a.js"></script>
  <script src="/a.js" async></script>
</svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(scripts(head!).map((t) => t.blocking ?? false)).toEqual([true, false]);
  });

  it('models only literal src: dynamic src={expr} scripts produce no script tag', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': `<script>let a = '/a.js'; let b = '/b.js';</script>
<svelte:head><script src={a}></script><script src={b}></script></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    expect(scripts(head!)).toEqual([]);
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

describe('collectRoutes a11y composition', () => {
  const a11yOf = async (files: Record<string, string>, appHtmlIds?: { id: string; line: number }[]) =>
    (await collectRoutes(createMemoryRuntime(files), '', undefined, undefined, undefined, appHtmlIds)).a11y.find(
      (a) => a.route === '/'
    )!;

  it('counts a layout <main> and a page <main> as two representatives', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<main><slot /></main>`,
      'src/routes/+page.svelte': `<main>page</main>`
    });
    expect(a11y.landmarks.main).toEqual([
      { file: 'src/routes/+layout.svelte', line: 1 },
      { file: 'src/routes/+page.svelte', line: 1 }
    ]);
    expect(a11y.fullyResolved).toBe(true);
  });

  it('maps <aside> per HTML-AAM: complementary in body/main, demoted unnamed in sectioning content', async () => {
    const nested = async (page: string) =>
      (
        await a11yOf({ 'src/routes/+layout.svelte': `<main><slot /></main>`, 'src/routes/+page.svelte': page })
      ).nestedLandmarks.map((n) => n.kind);
    // Depth inside the page does not matter: an <aside> is a landmark wherever it sits, unlike
    // <header>/<footer>, whose landmark-ness depends on sectioning ancestry.
    expect(await nested('<aside>Related</aside>')).toEqual(['complementary']);
    expect(await nested('<div><aside>Related</aside></div>')).toEqual(['complementary']);
    expect(await nested('<article><aside>unnamed</aside></article>')).toEqual([]);
    expect(await nested('<article><aside aria-label="Notes">n</aside></article>')).toEqual(['complementary']);
    // An empty or whitespace-only label names nothing; an expression's value is unknowable.
    expect(await nested('<article><aside aria-label="">e</aside></article>')).toEqual([]);
    expect(await nested('<article><aside aria-labelledby="   ">w</aside></article>')).toEqual([]);
    expect(await nested('<article><aside aria-label={n}>d</aside></article>')).toEqual(['complementary']);
  });

  it('composes a metaComponents-declared component that is still resolvable (declaration is not an override)', async () => {
    const files = {
      'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
      'src/lib/A.svelte': `<main>a</main>`
    };
    const a11y = (
      await collectRoutes(createMemoryRuntime(files), '', defineConfig({ metaComponents: ['A'] }))
    ).a11y.find((a) => a.route === '/')!;
    expect(a11y.landmarks.main).toEqual([{ file: 'src/lib/A.svelte', line: 1 }]);
    expect(a11y.fullyResolved).toBe(true);
  });

  it('takes the max across exclusive branches, including across components', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';import B from '$lib/B.svelte';</script>{#if x}<A />{:else}<B />{/if}`,
      'src/lib/A.svelte': `<main>a</main>`,
      'src/lib/B.svelte': `<main>b</main>`
    });
    expect(a11y.landmarks.main).toEqual([{ file: 'src/lib/A.svelte', line: 1 }]);
  });

  it('composes a component reached through a barrel or a namespace import, keeping the world closed', async () => {
    for (const script of [`import { A } from '$lib';`, `import * as Ui from '$lib';`]) {
      const tag = script.includes('*') ? 'Ui.A' : 'A';
      const a11y = await a11yOf({
        'src/routes/+page.svelte': `<script>${script}</script><${tag} />`,
        'src/lib/index.ts': `export { default as A } from './A.svelte';`,
        'src/lib/A.svelte': `<main id="m">a</main>`
      });
      expect(a11y.landmarks.main).toEqual([{ file: 'src/lib/A.svelte', line: 1 }]);
      expect(a11y.fullyResolved).toBe(true);
    }
  });

  it('composes the candidates of a runtime-chosen component as exclusive arms', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';import B from '$lib/B.svelte';const C = $derived(x ? A : B);</script><C />`,
      'src/lib/A.svelte': `<main>a</main>`,
      'src/lib/B.svelte': `<main>b</main>`
    });
    expect(a11y.landmarks.main).toEqual([{ file: 'src/lib/A.svelte', line: 1 }]);
    expect(a11y.fullyResolved).toBe(true);
  });

  it('keeps the conditionals of two components apart instead of folding them as one block', async () => {
    // Both <main>s render together; they are exclusive only if the two files' block
    // numbering is allowed to collide (A's branch 0 vs B's branch 1 of "group 0").
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';import B from '$lib/B.svelte';</script><A /><B />`,
      'src/lib/A.svelte': `{#if x}<main>a</main>{/if}`,
      'src/lib/B.svelte': `{#if x}<span>b</span>{:else}<main>b</main>{/if}`
    });
    expect(a11y.landmarks.main).toHaveLength(2);
  });

  it('counts <header> only from a chain file at top level', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<script>import Bar from '$lib/Bar.svelte';</script><header>site</header><Bar /><slot />`,
      'src/routes/+page.svelte': `<section><header>card</header></section>`,
      'src/lib/Bar.svelte': `<header>bar</header>`
    });
    expect(a11y.landmarks.banner).toEqual([{ file: 'src/routes/+layout.svelte', line: 1 }]);
  });

  it('reports a page landmark nested in the layout slot landmark', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<main><slot /></main>`,
      'src/routes/+page.svelte': `<main>page</main>`
    });
    expect(a11y.nestedLandmarks).toEqual([{ kind: 'main', within: 'main', file: 'src/routes/+page.svelte', line: 1 }]);
  });

  it('does not count a page <header>/<footer> rendered inside a layout <main> or <aside> as a landmark', async () => {
    for (const wrapper of ['main', 'aside']) {
      const a11y = await a11yOf({
        'src/routes/+layout.svelte': `<header>site</header><${wrapper}><slot /></${wrapper}>`,
        'src/routes/+page.svelte': `<header>page</header><p>body</p><footer>page</footer>`
      });
      expect(a11y.nestedLandmarks).toEqual([]);
      expect(a11y.landmarks.banner).toEqual([{ file: 'src/routes/+layout.svelte', line: 1 }]);
      expect(a11y.landmarks.contentinfo ?? []).toEqual([]);
    }
  });

  it('still reports a page <header> rendered inside a layout <footer>', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<footer><slot /></footer>`,
      'src/routes/+page.svelte': `<header>page</header>`
    });
    expect(a11y.nestedLandmarks).toEqual([
      { kind: 'banner', within: 'contentinfo', file: 'src/routes/+page.svelte', line: 1 }
    ]);
  });

  it('does not report a <header> scoped by its <main> ancestor as a nested landmark', async () => {
    // Below the top level a <header> may be scoped by main/article/…, which strips the banner
    // mapping — the same reason it is not counted in `landmarks`.
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<main><header>h</header></main>` });
    expect(a11y.nestedLandmarks).toEqual([]);
  });

  it('places a landmark inside a non-landmark <header>/<footer> in the landmark around it', async () => {
    const nested = async (layout: string, page: string) =>
      (await a11yOf({ 'src/routes/+layout.svelte': layout, 'src/routes/+page.svelte': page })).nestedLandmarks.map(
        (n) => `${n.kind} in ${n.within}`
      );
    const aside = '<aside aria-label="Sources">s</aside>';
    // Below the top level, and at the top level of a page the layout renders inside <main>.
    expect(await nested('<main><slot /></main>', `<section><header>${aside}</header></section>`)).toEqual([
      'complementary in main'
    ]);
    expect(await nested('<main><slot /></main>', `<header>${aside}</header>`)).toEqual(['complementary in main']);
    expect(await nested('<slot />', `<section><footer>${aside}</footer></section>`)).toEqual([]);
    // A banner reached through the layout's slot is demoted the same way.
    const viaSlot = await collectRoutes(
      createMemoryRuntime({
        'src/routes/+layout.svelte': '<main><slot /></main>',
        'src/routes/a/+layout.svelte': '<header><slot /></header>',
        'src/routes/a/+page.svelte': aside
      }),
      ''
    );
    expect(viaSlot.a11y.find((a) => a.route === '/a')!.nestedLandmarks.map((n) => n.within)).toEqual(['main']);
    // Past the header, the nearest in-file landmark still wraps the content.
    expect(await nested('<main><slot /></main>', `<div role="complementary"><header>${aside}</header></div>`)).toEqual([
      'complementary in main',
      'complementary in complementary'
    ]);
    // A header or footer outside any sectioning content is a landmark and contains what it wraps.
    expect(await nested('<slot />', `<header>${aside}</header>`)).toEqual(['complementary in banner']);
    expect(await nested('<slot />', '<div><footer><aside>a</aside></footer></div>')).toEqual([
      'complementary in contentinfo'
    ]);
    expect(await nested('<main><slot /></main>', `<div role="banner">${aside}</div>`)).toEqual([
      'banner in main',
      'complementary in banner'
    ]);
  });

  it('does not report a landmark inside {#each} as nested — it may render zero times', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<main><slot /></main>`,
      'src/routes/+page.svelte': `{#each items as item}<header>{item}</header>{/each}`
    });
    expect(a11y.nestedLandmarks).toEqual([]);
  });

  it('orders representatives chain-first, not fold-first', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `{#if x}<main>layout</main>{/if}<slot />`,
      'src/routes/+page.svelte': `<p>page</p>\n<main>page</main>`
    });
    expect(a11y.landmarks.main).toEqual([
      { file: 'src/routes/+layout.svelte', line: 1 },
      { file: 'src/routes/+page.svelte', line: 2 }
    ]);
  });

  it('places the page inside the layout arm that renders children', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<script>import F from '$lib/F.svelte';</script>{#if a}<F />{:else if b}<main>l</main>{:else}{@render children()}{/if}`,
      'src/routes/+page.svelte': `<main><F /></main>`,
      'src/lib/F.svelte': `<div id="x"></div>`
    });
    expect(a11y.ids.x).toHaveLength(1);
    expect(a11y.landmarks.main).toHaveLength(1);
  });

  it('places the page through nested layouts, each at its own slot arm', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `{#if a}<div id="x"></div>{:else}<slot />{/if}`,
      'src/routes/(g)/+layout.svelte': `{#if b}<slot />{:else}<div id="y"></div>{/if}`,
      'src/routes/(g)/+page.svelte': `<div id="x"></div><div id="y"></div>`
    });
    expect(a11y.ids.x).toHaveLength(1);
    expect(a11y.ids.y).toHaveLength(1);
  });

  it('still sums the page with layout content in the arm that renders children', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `{#if a}<p></p>{:else}<div id="x"></div>{@render children()}{/if}`,
      'src/routes/+page.svelte': `<div id="x"></div>`
    });
    expect(a11y.ids.x).toHaveLength(2);
  });

  it('places the page above the arms when every arm renders children', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `{#if a}{@render children()}{:else}<div id="x"></div>{@render children()}{/if}`,
      'src/routes/+page.svelte': `<div id="x"></div>`
    });
    expect(a11y.ids.x).toHaveLength(2);
  });

  it('keeps an element-free slot block from sharing its group id with a layout component', async () => {
    const a11y = await a11yOf({
      'src/routes/+layout.svelte': `<script>import C from '$lib/C.svelte';</script>{#if a}<slot />{/if}<C />`,
      'src/routes/+page.svelte': `<div id="x"></div>`,
      'src/lib/C.svelte': `{#if c}<p></p>{:else}<div id="x"></div>{/if}`
    });
    expect(a11y.ids.x).toHaveLength(2);
  });

  it('satisfies a layout id reference with a page id, and with an app.html id', async () => {
    const a11y = await a11yOf(
      {
        'src/routes/+layout.svelte': `<label for="x">Name</label><a href="#top">up</a><slot />`,
        'src/routes/+page.svelte': `<div id="x"></div>`
      },
      [{ id: 'app', line: 1 }]
    );
    expect(a11y.idCandidates).toEqual(['x', 'app']);
    // `href="#top"` needs no element of that id.
    expect(a11y.idRefs).toEqual([{ id: 'x', attr: 'for', file: 'src/routes/+layout.svelte', line: 1 }]);
    expect(a11y.ids.x).toHaveLength(1);
    expect(a11y.fullyResolved).toBe(true);
    expect(a11y.unresolvedCauses).toBeUndefined();
  });

  it('prepends the shell representative for a colliding id, first and with its line', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id="shell-root"></div>` }, [
      { id: 'shell-root', line: 8 }
    ]);
    expect(a11y.ids['shell-root']).toEqual([
      { file: 'src/app.html', line: 8 },
      { file: 'src/routes/+page.svelte', line: 1 }
    ]);
  });

  it('a shell id with no route collision never enters the ids map', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id="own"></div>` }, [{ id: 'lonely', line: 3 }]);
    expect(a11y.ids['lonely']).toBeUndefined();
    expect(a11y.idCandidates).toContain('lonely');
  });

  it('an each-body-only route id does not collide with the shell', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `{#each items as x}<li id="shell-root"></li>{/each}` }, [
      { id: 'shell-root', line: 8 }
    ]);
    expect(a11y.ids['shell-root']).toBeUndefined();
  });

  it('collects every literal id as a candidate but counts only unconditional ones', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `{#each items as item}<li id="row"></li>{/each}<p id="row"></p>`
    });
    expect(a11y.idCandidates).toEqual(['row']);
    expect(a11y.ids.row).toEqual([{ file: 'src/routes/+page.svelte', line: 1 }]);
  });

  it('collects the ARIA id-reference properties and the HTML targets as references', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<div aria-owns="x y" aria-errormessage="e"></div><input list="opts" /><td headers="h1 h2"></td><button popovertarget="pop"></button>`
    });
    expect(a11y.idRefs.map((r) => `${r.attr}=${r.id}`)).toEqual([
      'aria-owns=x',
      'aria-owns=y',
      'aria-errormessage=e',
      'list=opts',
      'headers=h1',
      'headers=h2',
      'popovertarget=pop'
    ]);
  });

  it('opens the world for an unresolvable component', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script><Fancy />`
    });
    expect(a11y.fullyResolved).toBe(false);
    expect(a11y.unresolvedCauses).toEqual([
      { kind: 'component', detail: 'Fancy', file: 'src/routes/+page.svelte', line: 1 }
    ]);
  });

  it('opens the world for a dynamic id, which is no candidate', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id={x}></div>` });
    expect(a11y.fullyResolved).toBe(false);
    expect(a11y.idCandidates).toEqual([]);
    expect(a11y.ids).toEqual({});
    expect(a11y.unresolvedCauses).toEqual([{ kind: 'dynamic-id', file: 'src/routes/+page.svelte', line: 1 }]);
  });

  it('opens the world for {@html} content', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div>{@html body}</div>` });
    expect(a11y.fullyResolved).toBe(false);
    expect(a11y.unresolvedCauses).toEqual([{ kind: 'html', file: 'src/routes/+page.svelte', line: 1 }]);
  });

  it('records a spread attribute as a located cause', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<h1>t</h1>\n<div {...rest}>spread</div>`
    });
    expect(a11y.fullyResolved).toBe(false);
    expect(a11y.unresolvedCauses).toEqual([{ kind: 'spread', file: 'src/routes/+page.svelte', line: 2 }]);
  });

  it('dedupes causes by (kind, file, detail), keeping the first line', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script>\n<Fancy />\n<Fancy />\n<div {...a}>x</div>\n<div {...b}>y</div>`
    });
    expect(a11y.unresolvedCauses).toHaveLength(2);
    expect(a11y.unresolvedCauses).toEqual(
      expect.arrayContaining([
        { kind: 'component', detail: 'Fancy', file: 'src/routes/+page.svelte', line: 2 },
        { kind: 'spread', file: 'src/routes/+page.svelte', line: 4 }
      ])
    );
  });

  describe('elementTags / elementsClosed (a11y/required-element)', () => {
    const tagsOf = async (files: Record<string, string>, appHtmlBodyTags?: string[]) =>
      (
        await collectRoutes(createMemoryRuntime(files), '', undefined, undefined, undefined, undefined, appHtmlBodyTags)
      ).a11y.find((a) => a.route === '/')!;

    it('unions body tags across the layout chain, the page, resolved components and the shell body', async () => {
      const a11y = await tagsOf(
        {
          'src/routes/+layout.svelte': `<nav>n</nav><slot />`,
          'src/routes/+page.svelte': `<script>import Card from '$lib/Card.svelte';</script><h1>t</h1><Card />`,
          'src/lib/Card.svelte': `<article><p>x</p></article>`
        },
        ['main']
      );
      expect([...a11y.elementTags!].sort()).toEqual(['article', 'h1', 'main', 'nav', 'p']);
      expect(a11y.elementsClosed).toBe(true);
      expect(a11y.file).toBe('src/routes/+page.svelte');
    });

    it('is body-scoped: <svelte:head> content and <template> children do not count', async () => {
      const a11y = await tagsOf({
        'src/routes/+page.svelte': `<svelte:head><title>t</title></svelte:head><template><main>x</main></template><svelte:element this="section">s</svelte:element><div>d</div>`
      });
      // A `<svelte:element>` the walk can resolve counts as the element it renders.
      expect([...a11y.elementTags!].sort()).toEqual(['div', 'section', 'template']);
      expect(a11y.elementsClosed).toBe(true);
      const branches = await tagsOf({
        'src/routes/+page.svelte': `<svelte:element this={wide ? 'h1' : 'h2'}>s</svelte:element>`
      });
      expect([...branches.elementTags!].sort()).toEqual(['h1', 'h2']);
      // Both branches naming the same tag is one definite element, not two possibilities.
      const same = await tagsOf({
        'src/routes/+page.svelte': `<svelte:element this={wide ? 'main' : 'main'}>s</svelte:element>`
      });
      expect(Object.keys(same.landmarks)).toEqual(['main']);
      // A tag the expression does not pin down can render anything the walk cannot see.
      const expr = await tagsOf({ 'src/routes/+page.svelte': `<svelte:element this={tag}>s</svelte:element>` });
      expect(expr.elementsClosed).toBe(false);
    });

    it('is closed by neither a spread nor an expression id, and open by {@html} or an unresolved component', async () => {
      const spread = await tagsOf({ 'src/routes/+page.svelte': `<div {...p} id={x}><main>m</main></div>` });
      expect(spread.fullyResolved).toBe(false);
      expect(spread.elementsClosed).toBe(true);
      const html = await tagsOf({ 'src/routes/+page.svelte': `<div>{@html body}</div>` });
      expect(html.elementsClosed).toBe(false);
      const pkg = await tagsOf({
        'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script><Fancy />`
      });
      expect(pkg.elementsClosed).toBe(false);
    });
  });
});
