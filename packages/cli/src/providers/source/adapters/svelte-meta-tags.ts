import type { AST } from 'svelte/compiler';
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import { attrValueOf, attrTextOf } from '@svelte-vitals/core/internal';
import { exprValue, resolveMetaObject, OPEN_GRAPH_KEYS, TWITTER_KEYS } from './meta-object.js';
import type { Adapter, AdapterResult } from './types.js';

function findAttr(attributes: ComponentUse['attributes'], name: string): AST.Attribute | undefined {
  return attributes.find((a): a is AST.Attribute => a.type === 'Attribute' && a.name === name);
}

/** svelte-meta-tags <MetaTags> (named import) or the MetaTags.svelte subpath (default import). */
export const svelteMetaTagsAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    if (info.source === 'svelte-meta-tags') return info.imported === 'MetaTags';
    if (info.source === 'svelte-meta-tags/MetaTags.svelte') return info.imported === 'default';
    return false;
  },

  resolve(use: ComponentUse): AdapterResult {
    const tags: ParsedTag[] = [];
    const attrs = use.attributes;

    const titleAttr = findAttr(attrs, 'title');
    const templateAttr = findAttr(attrs, 'titleTemplate');
    const title = titleAttr ?? templateAttr;
    if (title) {
      const value = attrValueOf(title);
      // Capture measurable text only for a bare static title — not the template itself
      // (a `%s | …` pattern), and not when a titleTemplate wraps the title (the rendered
      // title would be longer, so measuring the literal alone would false-positive seo/title-length).
      const text = titleAttr && !templateAttr && value === 'static' ? attrTextOf(titleAttr) : undefined;
      tags.push({ kind: 'title', value, ...(text !== undefined ? { text } : {}) });
    }

    const description = findAttr(attrs, 'description');
    if (description) {
      const value = attrValueOf(description);
      const text = value === 'static' ? attrTextOf(description) : undefined;
      tags.push({ kind: 'meta', name: 'description', value, ...(text !== undefined ? { text } : {}) });
    }

    const canonical = findAttr(attrs, 'canonical');
    if (canonical) tags.push({ kind: 'link', rel: 'canonical', value: attrValueOf(canonical) });

    const robots = findAttr(attrs, 'robots');
    if (robots) tags.push({ kind: 'meta', name: 'robots', value: attrValueOf(robots) });

    // Introspect inline openGraph / twitter object literals into specific og:*/twitter:card
    // tags. A variable-passed object (openGraph={cfg}) or a spread is unreadable → fall back
    // to broad coverage (BROAD_KINDS fills the og family + twitter:card).
    const og = resolveMetaObject(findAttr(attrs, 'openGraph'), OPEN_GRAPH_KEYS);
    const tw = resolveMetaObject(findAttr(attrs, 'twitter'), TWITTER_KEYS);
    tags.push(...og.tags, ...tw.tags, ...additionalMetaTags(findAttr(attrs, 'additionalMetaTags')));
    const broad = use.hasSpread || og.opaque || tw.opaque;

    return { tags, broad };
  }
};

/**
 * `additionalMetaTags={[{ property: 'og:image', content }]}`: one `<meta>` per object. An entry whose
 * key is not a literal, or a list that is not an inline array, may be any meta, so it only rules out
 * "missing" for metas.
 */
function additionalMetaTags(attr: AST.Attribute | undefined): ParsedTag[] {
  if (!attr) return [];
  const anyMeta: ParsedTag = { kind: 'meta', value: 'dynamic', dynamicKey: { name: true, property: true } };
  const expr = attr.value !== true && !Array.isArray(attr.value) ? attr.value.expression : undefined;
  if (expr?.type !== 'ArrayExpression') return [anyMeta];
  return expr.elements.map((el) => {
    if (el?.type !== 'ObjectExpression') return anyMeta;
    const prop = (key: string) =>
      el.properties.find(
        (p) => p.type === 'Property' && !p.computed && p.key.type === 'Identifier' && p.key.name === key
      ) as { value: Parameters<typeof exprValue>[0] } | undefined;
    const literal = (key: string) => {
      const v = prop(key)?.value;
      return v?.type === 'Literal' && typeof v.value === 'string' ? v.value : undefined;
    };
    if (el.properties.some((p) => p.type !== 'Property' || p.computed)) return anyMeta;
    const name = literal('name')?.toLowerCase();
    const property = literal('property');
    if (!name && !property) return anyMeta;
    return {
      kind: 'meta',
      ...(name ? { name } : {}),
      ...(property ? { property } : {}),
      value: exprValue(prop('content')?.value)
    };
  });
}
