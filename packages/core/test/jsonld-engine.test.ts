import { describe, it, expect } from 'vitest';
import {
  parseJsonLd,
  collectValues,
  isAbsoluteUrl,
  isIso8601,
  hasPlaceholder,
  typeOf,
  URL_KEYS,
  REQUIRED_PROPS
} from '../src/rules/seo/jsonld-engine.js';

describe('parseJsonLd', () => {
  it('flattens a top-level object', () => {
    const r = parseJsonLd('{"@type":"WebPage"}');
    expect(r.ok).toBe(true);
    expect(r.nodes).toHaveLength(1);
  });
  it('flattens @graph members (plus the container)', () => {
    const r = parseJsonLd('{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"Person"}]}');
    expect(
      r.nodes
        .map((n) => typeOf(n)[0])
        .filter(Boolean)
        .sort()
    ).toEqual(['Article', 'Person']);
    expect(r.nodes.some((n) => '@context' in n)).toBe(true);
  });
  it('flattens a top-level array', () => {
    const r = parseJsonLd('[{"@type":"A"},{"@type":"B"}]');
    expect(r.nodes).toHaveLength(2);
  });
  it('reports parse errors', () => {
    expect(parseJsonLd('{bad json').ok).toBe(false);
  });
});

describe('collectValues (deep)', () => {
  it('collects values under known keys through nesting', () => {
    const { nodes } = parseJsonLd('{"@type":"Product","name":"x","image":"/a.png","offers":{"url":"/buy"}}');
    expect(collectValues(nodes, URL_KEYS).sort()).toEqual(['/a.png', '/buy']);
  });
});

describe('predicates', () => {
  it('isAbsoluteUrl', () => {
    expect(isAbsoluteUrl('https://e.com/a')).toBe(true);
    expect(isAbsoluteUrl('/a')).toBe(false);
    expect(isAbsoluteUrl('a/b')).toBe(false);
  });
  it('isIso8601', () => {
    expect(isIso8601('2026-06-26')).toBe(true);
    expect(isIso8601('2026-06-26T10:00:00Z')).toBe(true);
    expect(isIso8601('June 26, 2026')).toBe(false);
  });
  it('hasPlaceholder', () => {
    expect(hasPlaceholder('Lorem ipsum dolor')).toBe(true);
    expect(hasPlaceholder('Your Company Name')).toBe(true);
    expect(hasPlaceholder('Acme Corp')).toBe(false);
  });
});

describe('REQUIRED_PROPS', () => {
  it('covers the common types', () => {
    expect(REQUIRED_PROPS['Product']).toContain('name');
    expect(REQUIRED_PROPS['BreadcrumbList']).toContain('itemListElement');
  });
});
