import { describe, it, expect } from 'vitest';
import { parseHeadTags, parseFile } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;

describe('parse: charset capture (seo/charset)', () => {
  it('models <meta charset> as a name:charset tag', () => {
    const tags = parseHeadTags(head('<meta charset="utf-8" />'), 'x.svelte');
    expect(tags).toContainEqual({ kind: 'meta', name: 'charset', value: 'static' });
  });
});

describe('parse: hreflang capture (seo/hreflang)', () => {
  it('captures a literal hreflang on a link', () => {
    const tags = parseHeadTags(head('<link rel="alternate" hreflang="en-US" href="/en" />'), 'x.svelte');
    const link = tags.find((t) => t.kind === 'link')!;
    expect(link.rel).toBe('alternate');
    expect(link.hreflang).toBe('en-US');
  });
  it('leaves hreflang undefined when dynamic', () => {
    const tags = parseHeadTags(head('<link rel="alternate" hreflang={lang} href="/en" />'), 'x.svelte');
    expect(tags.find((t) => t.kind === 'link')!.hreflang).toBeUndefined();
  });
  it('keeps a literal empty hreflang="" (present-but-invalid)', () => {
    const tags = parseHeadTags(head('<link rel="alternate" hreflang="" href="/en" />'), 'x.svelte');
    expect(tags.find((t) => t.kind === 'link')!.hreflang).toBe('');
  });
});

describe('parse: link href capture (performance/preconnect)', () => {
  it('captures a literal href on a link', () => {
    const tags = parseHeadTags(head('<link rel="preconnect" href="https://fonts.gstatic.com" />'), 'x.svelte');
    expect(tags.find((t) => t.kind === 'link')!.href).toBe('https://fonts.gstatic.com');
  });
});

describe('parse: head script capture (performance/render-blocking-script, performance/preconnect)', () => {
  it('marks a sync <script src> in svelte:head as blocking', () => {
    const t = parseHeadTags(head('<script src="/a.js"></script>'), 'x.svelte').find((t) => t.kind === 'script')!;
    expect(t.href).toBe('/a.js');
    expect(t.blocking).toBe(true);
  });
  it('does not mark defer/async/module scripts as blocking', () => {
    for (const attr of ['defer', 'async', 'type="module"']) {
      const t = parseHeadTags(head(`<script src="/a.js" ${attr}></script>`), 'x.svelte').find(
        (t) => t.kind === 'script'
      )!;
      expect(t.blocking).toBeUndefined();
    }
  });
  it('does not mark non-executing script types as blocking (they never run as a classic script)', () => {
    for (const type of ['text/partytown', 'importmap', 'speculationrules']) {
      const t = parseHeadTags(head(`<script src="/a.js" type="${type}"></script>`), 'x.svelte').find(
        (t) => t.kind === 'script'
      )!;
      expect(t.blocking).toBeUndefined();
    }
  });
  it('keeps JSON-LD as kind jsonld (not script)', () => {
    const tags = parseHeadTags(head('<script type="application/ld+json">{"@type":"Thing"}</script>'), 'x.svelte');
    expect(tags.some((t) => t.kind === 'jsonld')).toBe(true);
    expect(tags.some((t) => t.kind === 'script')).toBe(false);
  });
});

describe('parse: image loading/srcset capture (performance/lcp-image, performance/responsive-image)', () => {
  it('records lazy only for a literal loading="lazy"', () => {
    expect(parseFile('<img src="/a.jpg" loading="lazy" />', 'x.svelte').images[0]!.lazy).toBe(true);
    expect(parseFile('<img src="/a.jpg" loading="eager" />', 'x.svelte').images[0]!.lazy).toBe(false);
    expect(parseFile('<img src="/a.jpg" />', 'x.svelte').images[0]!.lazy).toBe(false);
  });
  it('records hasSrcset from the srcset attribute', () => {
    expect(parseFile('<img src="/a.jpg" srcset="/a-2x.jpg 2x" />', 'x.svelte').images[0]!.hasSrcset).toBe(true);
    expect(parseFile('<img src="/a.jpg" />', 'x.svelte').images[0]!.hasSrcset).toBe(false);
  });
  it('records hasSrcset for a <picture> fallback whose <source> carries one', () => {
    const srcset = (src: string) => parseFile(src, 'x.svelte').images.map((i) => i.hasSrcset);
    expect(srcset('<picture><source srcset="/a-640.avif 640w" sizes="100vw" /><img src="/a.jpg" /></picture>')).toEqual(
      [true]
    );
    expect(srcset('<picture>{#if x}<source {...s} />{/if}<img src="/a.jpg" /></picture>')).toEqual([true]);
    expect(
      srcset('<picture><source media="(min-width: 1px)" /><img src="/a.jpg" /></picture><img src="/b.jpg" />')
    ).toEqual([false, false]);
    expect(srcset('<picture><source srcset="/a.avif" /><img src="/a.jpg" /></picture><img src="/b.jpg" />')).toEqual([
      true,
      false
    ]);
  });
  it('marks an SVG source: a literal or base-prefixed .svg path, or an imported .svg', () => {
    const svg = (src: string) => parseFile(src, 'x.svelte').images[0]!.svg;
    expect(svg('<img src="/rss.svg?v=2" />')).toBe(true);
    expect(svg('<img src="{base}/icons/rss.svg" />')).toBe(true);
    expect(svg("<script>import logo from '$lib/logo.svg';</script><img src={logo} />")).toBe(true);
    expect(svg("<img src={'/rss.svg'} />")).toBe(true);
    expect(svg('<img src="/a.jpg" />')).toBeUndefined();
    expect(svg("<script>import hero from '$lib/hero.png';</script><img src={hero} />")).toBeUndefined();
    expect(svg('<img src={url} />')).toBeUndefined();
  });
});

describe('parse: image alt capture (seo/image-alt)', () => {
  it('records hasAlt true/false from the alt attribute', () => {
    const withAlt = parseFile('<img src="/a.jpg" alt="A" />', 'x.svelte').images[0]!;
    const noAlt = parseFile('<img src="/a.jpg" />', 'x.svelte').images[0]!;
    expect(withAlt.hasAlt).toBe(true);
    expect(noAlt.hasAlt).toBe(false);
  });
  it('treats empty alt="" as present (decorative)', () => {
    expect(parseFile('<img src="/a.jpg" alt="" />', 'x.svelte').images[0]!.hasAlt).toBe(true);
  });
  it('treats a spread as possibly providing alt', () => {
    expect(parseFile('<img {...rest} />', 'x.svelte').images[0]!.hasAlt).toBe(true);
  });
});

describe('parse: heading capture (seo/single-h1)', () => {
  it('collects heading levels anywhere in the template', () => {
    const headings = parseFile('<h1>A</h1><section><h2>B</h2></section>', 'x.svelte').headings;
    expect(headings.map((h) => h.level)).toEqual([1, 2]);
  });
  it('collects headings inside conditional blocks', () => {
    const headings = parseFile('{#if x}<h1>A</h1>{/if}', 'x.svelte').headings;
    expect(headings.map((h) => h.level)).toEqual([1]);
  });
  it('does not count an <h1> inside <svelte:head> (body headings only)', () => {
    const headings = parseFile('<svelte:head><h1>X</h1></svelte:head><h1>Real</h1>', 'x.svelte').headings;
    expect(headings.map((h) => h.level)).toEqual([1]);
  });
  it('records the {#if}/{:else if}/{:else} and {#await} arm each heading sits in', () => {
    const src =
      '<h2>top</h2>{#if a}<h1>A</h1>{:else if b}<h1>B</h1>{:else}<h1>C</h1>{/if}' +
      '{#await p}<h3>wait</h3>{:then}{#if c}<h4>D</h4>{/if}{/await}';
    const paths = parseFile(src, 'x.svelte').headings.map((h) => h.path);
    expect(paths).toEqual([
      undefined,
      [{ group: 0, branch: 0 }],
      [{ group: 0, branch: 1 }],
      [{ group: 0, branch: 2 }],
      [{ group: 1, branch: 0 }],
      [
        { group: 1, branch: 1 },
        { group: 2, branch: 0 }
      ]
    ]);
  });
});

describe('parse: heading arms beyond {#if}/{#await}', () => {
  it('reads <svelte:boundary> children, failed and pending as arms of one block', () => {
    const src =
      '<svelte:boundary><h1>A</h1>{#snippet failed(e)}<h1>B</h1>{/snippet}' +
      '{#snippet pending()}<h1>C</h1>{/snippet}<h2>D</h2></svelte:boundary>';
    const paths = parseFile(src, 'x.svelte').headings.map((h) => h.path);
    expect(paths).toEqual([
      [{ group: 0, branch: 0 }],
      [{ group: 0, branch: 1 }],
      [{ group: 0, branch: 2 }],
      [{ group: 0, branch: 0 }]
    ]);
  });
  it('addresses component tags with the arm they sit in, numbered like the headings', () => {
    const parsed = parseFile('{#if a}<h1>A</h1>{/if}{#await p}{:then}<B />{:catch}<C />{/await}<D />', 'x.svelte');
    expect(parsed.components.map((c) => [c.name, c.path])).toEqual([
      ['B', [{ group: 1, branch: 1 }]],
      ['C', [{ group: 1, branch: 2 }]],
      ['D', []]
    ]);
    expect(parsed.headingGroups).toBe(2);
  });
  it('records where the layout renders its children, as the common prefix of each place', () => {
    expect(parseFile('<slot />', 'x.svelte').childrenPath).toEqual([]);
    expect(parseFile('<slot name="aside" />', 'x.svelte').childrenPath).toBeUndefined();
    expect(parseFile('{#if a}{@render children?.()}{:else}<h1>E</h1>{/if}', 'x.svelte').childrenPath).toEqual([
      { group: 0, branch: 0 }
    ]);
    expect(
      parseFile('{#if a}{#if b}{@render children()}{/if}{:else}{@render children()}{/if}', 'x.svelte').childrenPath
    ).toEqual([]);
  });
});

describe('parse: head tags inside blocks', () => {
  it('reads a title set in every branch of an if/else as one dynamic title', () => {
    const tags = parseHeadTags(
      head('{#if a}<title>One title</title>{:else}<title>Other title</title>{/if}'),
      'x.svelte'
    );
    expect(tags).toEqual([{ kind: 'title', value: 'dynamic' }]);
  });
  it('reads a tag in only some branches, or in each/await, as dynamic with no literal claims', () => {
    const tags = parseHeadTags(
      head(
        '{#if a}<meta name="description" content="Literal" />{/if}' +
          '{#each langs as l}<link rel="alternate" hreflang="en" href="/en" />{/each}' +
          '{#await p then v}<meta name="robots" content="noindex" />{/await}'
      ),
      'x.svelte'
    );
    expect(tags).toEqual([
      { kind: 'meta', name: 'description', value: 'dynamic' },
      { kind: 'link', rel: 'alternate', value: 'dynamic', href: '/en' },
      { kind: 'meta', name: 'robots', value: 'dynamic' }
    ]);
  });
  it('counts a tag repeated across exclusive branches once', () => {
    const tags = parseHeadTags(
      head('{#if a}<script src="/a.js"></script>{:else if b}<script src="/a.js"></script>{:else}<p></p>{/if}'),
      'x.svelte'
    );
    expect(tags).toEqual([{ kind: 'script', value: 'dynamic', href: '/a.js', blocking: true }]);
  });
  it('keeps literal values inside {#key}, which always renders once', () => {
    const tags = parseHeadTags(head('{#key k}<title>Keyed title</title>{/key}'), 'x.svelte');
    expect(tags).toEqual([{ kind: 'title', value: 'static', text: 'Keyed title' }]);
  });
});
