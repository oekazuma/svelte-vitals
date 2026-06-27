import { describe, it, expect } from 'vitest';
import { parseHeadTags, parseFile } from '../src/providers/source/parse.js';

const head = (inner: string) => `<svelte:head>${inner}</svelte:head>`;

describe('parse: charset capture (SEO024)', () => {
  it('models <meta charset> as a name:charset tag', () => {
    const tags = parseHeadTags(head('<meta charset="utf-8" />'), 'x.svelte');
    expect(tags).toContainEqual({ kind: 'meta', name: 'charset', value: 'static' });
  });
});

describe('parse: hreflang capture (SEO026)', () => {
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

describe('parse: image alt capture (SEO025)', () => {
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

describe('parse: heading capture (SEO027)', () => {
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
});
