import { parse, HTMLElement } from 'node-html-parser';
import type { HeadTag, Value } from '@svelte-vitals/core';

function attrValue(v: string | undefined): Value {
  return v !== undefined && v.trim().length > 0 ? 'static' : 'absent';
}

export interface ParsedHtmlHead {
  tags: HeadTag[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
  /** Page-body heading levels (the `n` in <hn>) found in the document (SEO027). */
  headings: number[];
}

/** Parse a fully-rendered HTML document's <head> into normalized head tags. */
export function parseHtmlHead(html: string): ParsedHtmlHead {
  const root = parse(html);
  const head = root.querySelector('head') ?? root;
  const tags: HeadTag[] = [];

  const title = head.querySelector('title');
  if (title) {
    const text = title.text;
    tags.push({
      kind: 'title',
      presence: 'own',
      value: attrValue(text),
      ...(text && text.trim().length > 0 ? { text } : {})
    });
  }

  for (const meta of head.querySelectorAll('meta')) {
    const name = meta.getAttribute('name');
    const property = meta.getAttribute('property');
    const charset = meta.getAttribute('charset');
    if (charset != null) {
      // <meta charset="…"> carries neither name nor property; model it as name:'charset' (SEO024).
      tags.push({ kind: 'meta', name: 'charset', presence: 'own', value: attrValue(charset) });
      continue;
    }
    if (!name && !property) continue;
    const content = name === 'robots' ? meta.getAttribute('content') : null;
    const noindex = content != null && /(^|[\s,])(noindex|none)([\s,]|$)/i.test(content);
    const descText = name === 'description' ? meta.getAttribute('content') : null;
    tags.push({
      kind: 'meta',
      ...(name ? { name } : {}),
      ...(property ? { property } : {}),
      presence: 'own',
      value: attrValue(meta.getAttribute('content')),
      ...(noindex ? { noindex: true } : {}),
      ...(descText && descText.trim().length > 0 ? { text: descText } : {})
    });
  }

  for (const link of head.querySelectorAll('link')) {
    const rel = link.getAttribute('rel');
    if (!rel) continue;
    const asAttr = link.getAttribute('as'); // rendered HTML: literal string or undefined
    const hasCrossorigin = link.hasAttribute('crossorigin');
    const hreflang = link.getAttribute('hreflang');
    tags.push({
      kind: 'link',
      rel,
      presence: 'own',
      value: attrValue(link.getAttribute('href')),
      ...(asAttr != null ? { hasAs: true, as: asAttr } : {}),
      ...(hasCrossorigin ? { hasCrossorigin: true } : {}),
      ...(hreflang ? { hreflang } : {})
    });
  }

  for (const script of head.querySelectorAll('script')) {
    if (script.getAttribute('type') === 'application/ld+json') {
      // `<script>` is a raw-text element — browsers and search engines read its body verbatim and do
      // NOT decode HTML entities. `.text` decodes (e.g. `&quot;` -> `"`), which would corrupt the JSON
      // before SEO016 parses it; `.rawText` preserves exactly what the crawler sees.
      const raw = script.rawText;
      tags.push({
        kind: 'jsonld',
        presence: 'own',
        value: attrValue(raw),
        ...(raw && raw.trim().length > 0 ? { jsonld: raw } : {})
      });
    }
  }

  const htmlEl = root.querySelector('html');
  const lang = htmlEl?.getAttribute('lang');
  const htmlLang =
    lang === undefined || lang === null
      ? { presence: 'none' as const, value: 'absent' as const }
      : { presence: 'own' as const, value: attrValue(lang) };

  // Page-body headings (SEO027). Walk the parsed tree in document order so the
  // levels match the static provider (which collects in AST order) — grouping by
  // level would diverge for inputs like <h2>…<h1>.
  const headings: number[] = [];
  const collectHeadings = (el: HTMLElement): void => {
    for (const child of el.childNodes) {
      if (child instanceof HTMLElement) {
        const m = /^h([1-6])$/i.exec(child.rawTagName ?? '');
        if (m) headings.push(Number(m[1]));
        collectHeadings(child);
      }
    }
  };
  collectHeadings(root);

  return { tags, htmlLang, headings };
}
