import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  performancePreconnect,
  seoHreflang,
  seoJsonLdValidity,
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

  it('still overrides the layout canonical with the page canonical (singular rel regression pin)', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+layout.svelte': `<svelte:head><link rel="canonical" href="https://example.com/" /></svelte:head>`,
      'src/routes/+page.svelte': `<svelte:head><link rel="canonical" href="https://example.com/page" /></svelte:head>`
    });
    const [head] = await collectHeads(rt, '');
    const canonicals = links(head!, 'canonical');
    expect(canonicals).toHaveLength(1);
    expect(canonicals[0]?.presence).toBe('own');
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
  const a11yOf = async (files: Record<string, string>, appHtmlIds?: string[]) =>
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

  it('takes the max across exclusive branches, including across components', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';import B from '$lib/B.svelte';</script>{#if x}<A />{:else}<B />{/if}`,
      'src/lib/A.svelte': `<main>a</main>`,
      'src/lib/B.svelte': `<main>b</main>`
    });
    expect(a11y.landmarks.main).toEqual([{ file: 'src/lib/A.svelte', line: 1 }]);
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
      'src/routes/+page.svelte': `<header>page</header>`
    });
    expect(a11y.nestedLandmarks).toEqual([
      { kind: 'banner', within: 'main', file: 'src/routes/+page.svelte', line: 1 }
    ]);
  });

  it('does not report a <header> scoped by its <main> ancestor as a nested landmark', async () => {
    // Below the top level a <header> may be scoped by main/article/…, which strips the banner
    // mapping — the same reason it is not counted in `landmarks`.
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<main><header>h</header></main>` });
    expect(a11y.nestedLandmarks).toEqual([]);
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

  it('satisfies a layout id reference with a page id, and with an app.html id', async () => {
    const a11y = await a11yOf(
      {
        'src/routes/+layout.svelte': `<label for="x">Name</label><a href="#top">up</a><slot />`,
        'src/routes/+page.svelte': `<div id="x"></div>`
      },
      ['app']
    );
    expect(a11y.idCandidates).toEqual(['x', 'app']);
    // `href="#top"` needs no element of that id.
    expect(a11y.idRefs).toEqual([{ id: 'x', attr: 'for', file: 'src/routes/+layout.svelte', line: 1 }]);
    expect(a11y.ids.x).toHaveLength(1);
    expect(a11y.fullyResolved).toBe(true);
  });

  it('collects every literal id as a candidate but counts only unconditional ones', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `{#each items as item}<li id="row"></li>{/each}<p id="row"></p>`
    });
    expect(a11y.idCandidates).toEqual(['row']);
    expect(a11y.ids.row).toEqual([{ file: 'src/routes/+page.svelte', line: 1 }]);
  });

  it('opens the world for an unresolvable component', async () => {
    const a11y = await a11yOf({
      'src/routes/+page.svelte': `<script>import Fancy from 'fancy-ui';</script><Fancy />`
    });
    expect(a11y.fullyResolved).toBe(false);
  });

  it('opens the world for a dynamic id, which is no candidate', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div id={x}></div>` });
    expect(a11y.fullyResolved).toBe(false);
    expect(a11y.idCandidates).toEqual([]);
    expect(a11y.ids).toEqual({});
  });

  it('opens the world for {@html} content', async () => {
    const a11y = await a11yOf({ 'src/routes/+page.svelte': `<div>{@html body}</div>` });
    expect(a11y.fullyResolved).toBe(false);
  });
});
