import type { Expression, Pattern } from 'estree';
import type { AST } from 'svelte/compiler';
import type { Value } from '@svelte-vitals/core';
import { attrTextOf, attrValueOf } from '@svelte-vitals/core/internal';
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import { exprValue } from './meta-object.js';
import type { Adapter, AdapterResult } from './types.js';

type Prop = Expression | Pattern;

function textOf(node: Prop | undefined): string | undefined {
  return node?.type === 'Literal' && typeof node.value === 'string' ? node.value : undefined;
}

function withText(tag: ParsedTag, node: Prop | undefined): ParsedTag {
  const text = tag.value === 'static' ? textOf(node) : undefined;
  return text !== undefined ? { ...tag, text } : tag;
}

/**
 * Tags svead's `<Head seo_config>` renders as of 0.0.12; 0.0.10–0.0.11 rendered og:* and twitter:card
 * only alongside `open_graph_image`. `undefined` is an unreadable config: `SeoConfig` requires `title`,
 * `description` and `url`, so their tags render with unknown values, and og:image may.
 */
function headTags(config: Map<string, Prop> | undefined): ParsedTag[] {
  const valueOf = (key: string): Value => (config ? exprValue(config.get(key)) : 'dynamic');
  const title = valueOf('title');
  const description = valueOf('description');
  const url = valueOf('url');
  const tags: ParsedTag[] = [];
  if (!config || config.has('title')) {
    tags.push(withText({ kind: 'title', value: title }, config?.get('title')));
    tags.push({ kind: 'meta', property: 'og:title', value: title });
  }
  if (!config || config.has('description')) {
    tags.push(withText({ kind: 'meta', name: 'description', value: description }, config?.get('description')));
    tags.push({ kind: 'meta', property: 'og:description', value: description });
  }
  if (!config || config.has('url')) {
    tags.push({ kind: 'link', rel: 'canonical', value: url });
    tags.push({ kind: 'meta', property: 'og:url', value: url });
  }
  if (!config || config.has('open_graph_image')) {
    tags.push({ kind: 'meta', property: 'og:image', value: valueOf('open_graph_image') });
  }
  // `content={twitter_card_type || 'summary_large_image'}` always renders a card.
  const card = config?.get('twitter_card_type');
  tags.push({
    kind: 'meta',
    name: 'twitter:card',
    value: config && (!card || card.type === 'Literal') ? 'static' : 'dynamic'
  });
  return tags;
}

/** The inline object literal passed as `seo_config`, or `undefined` when its keys cannot all be read. */
function literalConfig(use: ComponentUse): Map<string, Prop> | undefined {
  const attr = use.attributes.find((a) => a.type === 'Attribute' && a.name === 'seo_config');
  if (attr?.type !== 'Attribute' || attr.value === true || Array.isArray(attr.value)) return undefined;
  const expr = attr.value.expression;
  if (expr.type !== 'ObjectExpression') return undefined;
  const config = new Map<string, Prop>();
  for (const prop of expr.properties) {
    if (prop.type !== 'Property' || prop.computed) return undefined;
    const key =
      prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'Literal' ? prop.key.value : undefined;
    if (typeof key === 'string') config.set(key, prop.value);
  }
  return config;
}

/** The per-prop API before 0.0.10: og:* and twitter:card render only inside `{#if image}`. */
function legacyTags(use: ComponentUse): ParsedTag[] {
  const attr = (name: string) =>
    use.attributes.find((a): a is AST.Attribute => a.type === 'Attribute' && a.name === name);
  const textTag = (a: AST.Attribute, tag: ParsedTag): ParsedTag => {
    const text = tag.value === 'static' ? attrTextOf(a) : undefined;
    return text !== undefined ? { ...tag, text } : tag;
  };
  const tags: ParsedTag[] = [];
  const title = attr('title');
  if (title) tags.push(textTag(title, { kind: 'title', value: attrValueOf(title) }));
  const description = attr('description');
  if (description)
    tags.push(textTag(description, { kind: 'meta', name: 'description', value: attrValueOf(description) }));
  const url = attr('url');
  if (url) tags.push({ kind: 'link', rel: 'canonical', value: attrValueOf(url) });
  if (attr('image')) {
    for (const property of ['og:title', 'og:description', 'og:url', 'og:image'])
      tags.push({ kind: 'meta', property, value: 'dynamic' });
    tags.push({ kind: 'meta', name: 'twitter:card', value: 'dynamic' });
  }
  return tags;
}

/**
 * svead `<Head>` (named import). Its tag set is fixed by the component, so an unreadable
 * `seo_config` yields that set as dynamic rather than a broad source, which would also credit robots.
 */
export const sveadHeadAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    return info.source === 'svead' && info.imported === 'Head';
  },

  resolve(use: ComponentUse): AdapterResult {
    const hasConfig = use.hasSpread || use.attributes.some((a) => a.type === 'Attribute' && a.name === 'seo_config');
    return { tags: hasConfig ? headTags(literalConfig(use)) : legacyTags(use), broad: false };
  }
};

/** svead `<SchemaOrg>`: renders its JSON-LD through a split-string `{@html}`, like svelte-meta-tags' JsonLd. */
export const sveadSchemaOrgAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    return info.source === 'svead' && info.imported === 'SchemaOrg';
  },

  resolve(): AdapterResult {
    return { tags: [{ kind: 'jsonld', value: 'dynamic' }], broad: false };
  }
};
