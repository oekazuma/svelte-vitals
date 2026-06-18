import { parse } from 'node-html-parser';
import type { HeadTag, Value } from '@svelte-vitals/core';

function attrValue(v: string | undefined): Value {
  return v !== undefined && v.trim().length > 0 ? 'static' : 'absent';
}

export interface ParsedHtmlHead {
  tags: HeadTag[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
}

/** Parse a fully-rendered HTML document's <head> into normalized head tags. */
export function parseHtmlHead(html: string): ParsedHtmlHead {
  const root = parse(html);
  const head = root.querySelector('head') ?? root;
  const tags: HeadTag[] = [];

  const title = head.querySelector('title');
  if (title) tags.push({ kind: 'title', presence: 'own', value: attrValue(title.text) });

  for (const meta of head.querySelectorAll('meta')) {
    const name = meta.getAttribute('name');
    const property = meta.getAttribute('property');
    if (!name && !property) continue;
    tags.push({
      kind: 'meta',
      ...(name ? { name } : {}),
      ...(property ? { property } : {}),
      presence: 'own',
      value: attrValue(meta.getAttribute('content'))
    });
  }

  for (const link of head.querySelectorAll('link')) {
    const rel = link.getAttribute('rel');
    if (!rel) continue;
    tags.push({ kind: 'link', rel, presence: 'own', value: attrValue(link.getAttribute('href')) });
  }

  for (const script of head.querySelectorAll('script')) {
    if (script.getAttribute('type') === 'application/ld+json') {
      tags.push({ kind: 'jsonld', presence: 'own', value: attrValue(script.text) });
    }
  }

  const htmlEl = root.querySelector('html');
  const lang = htmlEl?.getAttribute('lang');
  const htmlLang =
    lang === undefined || lang === null
      ? { presence: 'none' as const, value: 'absent' as const }
      : { presence: 'own' as const, value: attrValue(lang) };

  return { tags, htmlLang };
}
