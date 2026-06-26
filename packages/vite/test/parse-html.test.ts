import { describe, it, expect } from 'vitest';
import { parseHtmlHead } from '../src/providers/rendered/parse-html.js';

const html = (head: string, lang = 'en') =>
  `<!doctype html><html lang="${lang}"><head>${head}</head><body></body></html>`;

describe('parseHtmlHead', () => {
  it('extracts title, meta(name/property), link, jsonld with static/absent values', () => {
    const { tags } = parseHtmlHead(
      html(
        `<title>About</title>` +
          `<meta name="description" content="A page"/>` +
          `<meta property="og:title" content="OG"/>` +
          `<meta name="empty" content=""/>` +
          `<link rel="canonical" href="https://x"/>` +
          `<script type="application/ld+json">{"@type":"Thing"}</script>`
      )
    );
    expect(tags).toContainEqual({ kind: 'title', presence: 'own', value: 'static' });
    expect(tags).toContainEqual({ kind: 'meta', name: 'description', presence: 'own', value: 'static' });
    expect(tags).toContainEqual({ kind: 'meta', property: 'og:title', presence: 'own', value: 'static' });
    expect(tags).toContainEqual({ kind: 'meta', name: 'empty', presence: 'own', value: 'absent' });
    expect(tags).toContainEqual({ kind: 'link', rel: 'canonical', presence: 'own', value: 'static' });
    expect(tags).toContainEqual({ kind: 'jsonld', presence: 'own', value: 'static', jsonld: '{"@type":"Thing"}' });
  });

  it('treats an empty title as absent', () => {
    const { tags } = parseHtmlHead(html(`<title></title>`));
    expect(tags).toContainEqual({ kind: 'title', presence: 'own', value: 'absent' });
  });

  it('reads <html lang>', () => {
    expect(parseHtmlHead(html(`<title>x</title>`, 'en')).htmlLang).toEqual({ presence: 'own', value: 'static' });
    expect(parseHtmlHead(html(`<title>x</title>`, '')).htmlLang).toEqual({ presence: 'own', value: 'absent' });
  });

  it('returns presence:none when <html> has no lang attribute', () => {
    const noLangHtml = `<!doctype html><html><head><title>x</title></head><body></body></html>`;
    expect(parseHtmlHead(noLangHtml).htmlLang).toEqual({ presence: 'none', value: 'absent' });
  });
});

describe('parse-html: link as/crossorigin', () => {
  it('captures as + crossorigin presence on a font preload', () => {
    const { tags } = parseHtmlHead(
      '<html><head><link rel="preload" href="/i.woff2" as="font" type="font/woff2" crossorigin></head><body></body></html>'
    );
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBe('font');
    expect(link.hasAs).toBe(true);
    expect(link.hasCrossorigin).toBe(true);
  });
  it('leaves as/crossorigin unset when absent', () => {
    const { tags } = parseHtmlHead('<html><head><link rel="preload" href="/a.js"></head><body></body></html>');
    const link = tags.find((t) => t.kind === 'link' && t.rel === 'preload')!;
    expect(link.as).toBeUndefined();
    expect(link.hasAs).toBeUndefined();
    expect(link.hasCrossorigin).toBeUndefined();
  });
});

describe('parse-html: robots noindex', () => {
  it('flags a rendered noindex robots meta', () => {
    const { tags } = parseHtmlHead('<html><head><meta name="robots" content="noindex"></head><body></body></html>');
    expect(tags.find((t) => t.kind === 'meta' && t.name === 'robots')!.noindex).toBe(true);
  });
  it('does not flag index,follow', () => {
    const { tags } = parseHtmlHead(
      '<html><head><meta name="robots" content="index,follow"></head><body></body></html>'
    );
    expect(tags.find((t) => t.kind === 'meta' && t.name === 'robots')!.noindex).toBeUndefined();
  });
});

describe('parse-html: jsonld raw capture', () => {
  it('captures the rendered JSON-LD text', () => {
    const { tags } = parseHtmlHead(
      '<html><head><script type="application/ld+json">{"@type":"WebPage"}</script></head><body></body></html>'
    );
    expect(tags.find((t) => t.kind === 'jsonld')!.jsonld).toBe('{"@type":"WebPage"}');
  });
  it('preserves HTML entities verbatim (script is raw-text; crawlers do not decode)', () => {
    // `&quot;` must NOT be decoded to `"` — doing so would corrupt the JSON and make SEO016 misreport.
    const body = '{"@context":"https://schema.org","@type":"Org","name":"Tom &quot;Cat&quot; Jones"}';
    const { tags } = parseHtmlHead(
      `<html><head><script type="application/ld+json">${body}</script></head><body></body></html>`
    );
    expect(tags.find((t) => t.kind === 'jsonld')!.jsonld).toBe(body);
  });
});
