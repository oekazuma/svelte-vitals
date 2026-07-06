/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Value } from '@svelte-vitals/core';
import type { ParsedTag } from '../parse.js';

type Node = any;

/** Value kind of an ESTree expression used as a prop or object-property value. */
export function exprValue(node: Node): Value {
  if (!node) return 'absent';
  if (node.type === 'Literal') {
    // A non-empty string literal is a concrete static value; other literals
    // (number/boolean) are static-present too. An empty string is absent.
    if (typeof node.value === 'string') return node.value.trim().length > 0 ? 'static' : 'absent';
    return 'static';
  }
  // Identifier / MemberExpression / TemplateLiteral / ArrayExpression / ObjectExpression / CallExpression …
  return 'dynamic';
}

export interface MetaObjectResult {
  /** Tags derived from the inline object literal's keys. */
  tags: ParsedTag[];
  /**
   * True when the prop is present but not fully readable as an inline literal
   * (a variable, or an object with a spread) — the caller should fall back to
   * broad coverage. False when absent or fully enumerated.
   */
  opaque: boolean;
}

/**
 * Introspect an inline object-literal prop (`openGraph` / `twitter`). Each known
 * key is mapped to a ParsedTag via `keyMap`. A non-literal prop (`openGraph={cfg}`)
 * or an object with a spread (`{...d, url}`) can't be fully enumerated, so it is
 * reported opaque for the caller to broaden.
 */
export function resolveMetaObject(
  attr: Node | undefined,
  keyMap: Record<string, (value: Value) => ParsedTag>
): MetaObjectResult {
  if (!attr) return { tags: [], opaque: false };
  const expr = attr.value?.type === 'ExpressionTag' ? attr.value.expression : undefined;
  if (!expr || expr.type !== 'ObjectExpression') return { tags: [], opaque: true };

  const tags: ParsedTag[] = [];
  let opaque = false;
  for (const prop of expr.properties ?? []) {
    if (prop?.type !== 'Property') {
      opaque = true; // SpreadElement — unknown extra keys
      continue;
    }
    const key = prop.key?.name ?? prop.key?.value;
    const make = typeof key === 'string' ? keyMap[key] : undefined;
    if (make) tags.push(make(exprValue(prop.value)));
  }
  return { tags, opaque };
}

/** openGraph keys → tags. Shared by svelte-meta-tags and svelte-seo (both mirror OG names). */
export const OPEN_GRAPH_KEYS: Record<string, (value: Value) => ParsedTag> = {
  title: (value) => ({ kind: 'meta', property: 'og:title', value }),
  description: (value) => ({ kind: 'meta', property: 'og:description', value }),
  url: (value) => ({ kind: 'meta', property: 'og:url', value }),
  images: (value) => ({ kind: 'meta', property: 'og:image', value }),
  type: (value) => ({ kind: 'meta', property: 'og:type', value })
};

/** twitter keys → twitter:card. svelte-meta-tags uses `cardType`; svelte-seo uses `card`. */
export const TWITTER_KEYS: Record<string, (value: Value) => ParsedTag> = {
  cardType: (value) => ({ kind: 'meta', name: 'twitter:card', value }),
  card: (value) => ({ kind: 'meta', name: 'twitter:card', value })
};
