import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import {
  exprValue,
  resolveMetaObject,
  OPEN_GRAPH_KEYS,
  TWITTER_KEYS
} from '../src/providers/source/adapters/meta-object.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function attrOf(tag: string, name: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ast = parse(`<script></script>${tag}`, { modern: true, filename: 'x.svelte' }) as any;
  const component = ast.fragment.nodes.find((n: any) => n.type === 'Component');
  return component.attributes.find((a: any) => a.type === 'Attribute' && a.name === name);
}

describe('resolveMetaObject', () => {
  it('emits og:url / og:description tags from an inline openGraph literal', () => {
    const attr = attrOf('<MetaTags openGraph={{ type: "website", url: SITE, description: "d" }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:description', value: 'static' });
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:type', value: 'static' });
  });

  it('does NOT emit a tag for a key the literal omits (precise)', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: SITE }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.tags.some((t) => t.kind === 'meta' && t.property === 'og:image')).toBe(false);
  });

  it('marks opaque when openGraph is a variable (not an inline literal)', () => {
    const attr = attrOf('<MetaTags openGraph={cfg} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(true);
    expect(r.tags).toHaveLength(0);
  });

  it('marks opaque when the object literal contains a spread', () => {
    const attr = attrOf('<MetaTags openGraph={{ ...defaults, url: SITE }} />', 'openGraph');
    const r = resolveMetaObject(attr, OPEN_GRAPH_KEYS);
    expect(r.opaque).toBe(true);
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
  });

  it('returns nothing (not opaque) when the prop is absent', () => {
    const r = resolveMetaObject(undefined, OPEN_GRAPH_KEYS);
    expect(r).toEqual({ tags: [], opaque: false });
  });

  it('maps twitter cardType and card to twitter:card', () => {
    const smt = resolveMetaObject(attrOf('<MetaTags twitter={{ cardType: "summary" }} />', 'twitter'), TWITTER_KEYS);
    expect(smt.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
    const seo = resolveMetaObject(attrOf('<Seo twitter={{ card: "summary" }} />', 'twitter'), TWITTER_KEYS);
    expect(seo.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
  });
});

describe('exprValue', () => {
  it('classifies a non-empty string literal as static', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: "https://x" }} />', 'openGraph');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (attr.value.expression.properties as any[])[0];
    expect(exprValue(prop.value)).toBe('static');
  });

  it('classifies an identifier as dynamic', () => {
    const attr = attrOf('<MetaTags openGraph={{ url: SITE }} />', 'openGraph');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prop = (attr.value.expression.properties as any[])[0];
    expect(exprValue(prop.value)).toBe('dynamic');
  });
});
