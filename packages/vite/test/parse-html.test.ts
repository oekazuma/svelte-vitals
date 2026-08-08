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
    expect(tags).toContainEqual({ kind: 'title', presence: 'own', value: 'static', text: 'About' });
    expect(tags).toContainEqual({
      kind: 'meta',
      name: 'description',
      presence: 'own',
      value: 'static',
      text: 'A page'
    });
    expect(tags).toContainEqual({ kind: 'meta', property: 'og:title', presence: 'own', value: 'static' });
    expect(tags).toContainEqual({ kind: 'meta', name: 'empty', presence: 'own', value: 'absent' });
    expect(tags).toContainEqual({
      kind: 'link',
      rel: 'canonical',
      presence: 'own',
      value: 'static',
      href: 'https://x'
    });
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
    // `&quot;` must NOT be decoded to `"` — doing so would corrupt the JSON and make seo/json-ld-validity misreport.
    const body = '{"@context":"https://schema.org","@type":"Org","name":"Tom &quot;Cat&quot; Jones"}';
    const { tags } = parseHtmlHead(
      `<html><head><script type="application/ld+json">${body}</script></head><body></body></html>`
    );
    expect(tags.find((t) => t.kind === 'jsonld')!.jsonld).toBe(body);
  });
});

describe('parse-html: title/description text capture', () => {
  it('captures decoded title text (RCDATA entities decoded)', () => {
    const { tags } = parseHtmlHead(html('<title>Caf&eacute; &amp; Bar</title>'));
    expect(tags.find((t) => t.kind === 'title')!.text).toBe('Café & Bar');
  });
  it('captures description content text', () => {
    const { tags } = parseHtmlHead(html('<meta name="description" content="A concise summary."/>'));
    const desc = tags.find((t) => t.kind === 'meta' && t.name === 'description')!;
    expect(desc.text).toBe('A concise summary.');
  });
  it('decodes HTML entities in description content (matches static mode + SERP)', () => {
    const { tags } = parseHtmlHead(html('<meta name="description" content="A &amp; B &mdash; C"/>'));
    const desc = tags.find((t) => t.kind === 'meta' && t.name === 'description')!;
    expect(desc.text).toBe('A & B — C');
  });
});

describe('parse-html: static-gaps capture (seo/charset, seo/hreflang, seo/single-h1)', () => {
  it('captures <meta charset> as a name:charset tag (seo/charset)', () => {
    const { tags } = parseHtmlHead(html('<meta charset="utf-8" />'));
    expect(tags).toContainEqual({ kind: 'meta', name: 'charset', presence: 'own', value: 'static' });
  });

  it('captures hreflang on a rel=alternate link (seo/hreflang)', () => {
    const { tags } = parseHtmlHead(html('<link rel="alternate" hreflang="en-US" href="/en" />'));
    const link = tags.find((t) => t.kind === 'link')!;
    expect(link.rel).toBe('alternate');
    expect(link.hreflang).toBe('en-US');
  });

  it('collects page-body heading levels in document order (seo/single-h1)', () => {
    // h2 before h1 locks document order (not level-grouped) and matches the static provider.
    const doc =
      '<!doctype html><html lang="en"><head><title>t</title></head>' +
      '<body><h2>Intro</h2><section><h1>A</h1><h2>B</h2></section></body></html>';
    expect(parseHtmlHead(doc).headings).toEqual([2, 1, 2]);
  });

  it('reports an empty body as no headings (seo/single-h1)', () => {
    expect(parseHtmlHead(html('<title>t</title>')).headings).toEqual([]);
  });

  it('ignores headings outside <body> (seo/single-h1)', () => {
    const doc = '<!doctype html><html lang="en"><head><h1>nope</h1></head><body><h1>A</h1></body></html>';
    expect(parseHtmlHead(doc).headings).toEqual([1]);
  });

  it('keeps a literal empty hreflang="" (seo/hreflang)', () => {
    const { tags } = parseHtmlHead(html('<link rel="alternate" hreflang="" href="/en" />'));
    expect(tags.find((t) => t.kind === 'link')!.hreflang).toBe('');
  });
});

describe('parse-html: image capture (rendered image-rule parity)', () => {
  const doc = (body: string) =>
    `<!doctype html><html lang="en"><head><title>t</title></head><body>${body}</body></html>`;

  it('collects <img> attribute flags from the body', () => {
    const { images } = parseHtmlHead(
      doc('<img src="/a.jpg" width="8" height="6" loading="lazy" srcset="/a-2x.jpg 2x" alt="A" />')
    );
    expect(images).toEqual([
      { hasWidth: true, hasHeight: true, hasLoading: true, hasAlt: true, lazy: true, hasSrcset: true, line: 0 }
    ]);
  });

  it('records false flags for a bare <img> and preserves document order', () => {
    const { images } = parseHtmlHead(doc('<img src="/first.jpg" alt="x" /><img src="/second.jpg" />'));
    expect(images).toHaveLength(2);
    expect(images[0]!.hasAlt).toBe(true);
    expect(images[1]!).toMatchObject({ hasWidth: false, hasAlt: false, lazy: false, hasSrcset: false });
  });

  it('reports no images for a page without <img>', () => {
    expect(parseHtmlHead(doc('<h1>t</h1>')).images).toEqual([]);
  });

  it('ignores an <img> outside <body> (body-scoped, like headings)', () => {
    const html =
      '<!doctype html><html lang="en"><head><title>t</title><img src="/head.jpg"></head>' +
      '<body><img src="/body.jpg" alt="x" /></body></html>';
    const { images } = parseHtmlHead(html);
    expect(images).toHaveLength(1);
    expect(images[0]!.hasAlt).toBe(true); // the body image, not the head one
  });
});

describe('parse-html: script capture (performance/render-blocking-script, performance/preconnect)', () => {
  it('marks a sync <script src> in head as blocking', () => {
    const { tags } = parseHtmlHead(html('<script src="/a.js"></script>'));
    const s = tags.find((t) => t.kind === 'script')!;
    expect(s.href).toBe('/a.js');
    expect(s.blocking).toBe(true);
  });
  it('does not mark defer/async/module scripts as blocking', () => {
    for (const attr of ['defer', 'async', 'type="module"']) {
      const { tags } = parseHtmlHead(html(`<script src="/a.js" ${attr}></script>`));
      expect(tags.find((t) => t.kind === 'script')!.blocking).toBeUndefined();
    }
  });
  it('does not mark non-executing script types as blocking (they never run as a classic script)', () => {
    for (const type of ['text/partytown', 'importmap', 'speculationrules']) {
      const { tags } = parseHtmlHead(html(`<script src="/a.js" type="${type}"></script>`));
      expect(tags.find((t) => t.kind === 'script')!.blocking).toBeUndefined();
    }
  });
  it('still captures JSON-LD scripts as kind jsonld (not script)', () => {
    const { tags } = parseHtmlHead(html('<script type="application/ld+json">{"@type":"Thing"}</script>'));
    expect(tags.some((t) => t.kind === 'jsonld')).toBe(true);
    expect(tags.some((t) => t.kind === 'script')).toBe(false);
  });
});
