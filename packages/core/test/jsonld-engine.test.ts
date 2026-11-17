import { describe, it, expect } from 'vitest';
import {
  parseJsonLd,
  collectValues,
  nodeStringValues,
  isAbsoluteUrl,
  isIso8601,
  hasPlaceholder,
  hasNonEmpty,
  typeOf,
  contextValues,
  URL_KEYS
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
  it('takes only objects from a top-level array as nodes', () => {
    expect(parseJsonLd('[1, null, "x", {"@type":"A"}]').nodes).toEqual([{ '@type': 'A' }]);
  });
});

describe('typeOf', () => {
  it('keeps only the string members of an @type array', () => {
    expect(typeOf({ '@type': ['A', 5, null, 'B'] })).toEqual(['A', 'B']);
  });
});

describe('contextValues', () => {
  it('collects @context values nested in objects and arrays', () => {
    const { nodes } = parseJsonLd(
      '{"@context":"https://schema.org","@type":"X","subjectOf":[{"@context":"a"}],"about":{"@context":"b"}}'
    );
    expect(contextValues(nodes).sort()).toEqual(['a', 'b', 'https://schema.org']);
  });
});

describe('collectValues (deep)', () => {
  it('collects values under known keys through nesting', () => {
    const { nodes } = parseJsonLd('{"@type":"Product","name":"x","image":"/a.png","offers":{"url":"/buy"}}');
    expect(collectValues(nodes, URL_KEYS).sort()).toEqual(['/a.png', '/buy']);
  });
  it('collects through arrays of objects, and only the string members of a keyed array', () => {
    const { nodes } = parseJsonLd('{"@type":"Product","offers":[{"url":"/a"}],"image":["/b",{"url":"/c"}]}');
    expect(collectValues(nodes, URL_KEYS).sort()).toEqual(['/a', '/b', '/c']);
  });
});

describe('predicates', () => {
  it('isAbsoluteUrl', () => {
    expect(isAbsoluteUrl('https://e.com/a')).toBe(true);
    expect(isAbsoluteUrl('/a')).toBe(false);
    expect(isAbsoluteUrl('a/b')).toBe(false);
    expect(isAbsoluteUrl('#frag')).toBe(false);
    expect(isAbsoluteUrl('./rel')).toBe(false);
  });
  it('isAbsoluteUrl trims, and needs the scheme at the start', () => {
    expect(isAbsoluteUrl('  https://e.com/a ')).toBe(true);
    expect(isAbsoluteUrl('/a/b:c')).toBe(false);
  });
  it('isAbsoluteUrl accepts protocol-relative and non-http schemes (no false positives)', () => {
    expect(isAbsoluteUrl('//cdn.example.com/x.png')).toBe(true); // protocol-relative
    expect(isAbsoluteUrl('data:image/png;base64,AAAA')).toBe(true); // data URI logo
    expect(isAbsoluteUrl('mailto:hi@example.com')).toBe(true);
    expect(isAbsoluteUrl('urn:isbn:9780000000000')).toBe(true);
  });
  it('isIso8601', () => {
    expect(isIso8601('2026-06-26')).toBe(true);
    expect(isIso8601('2026-06-26T10:00:00Z')).toBe(true);
    expect(isIso8601('June 26, 2026')).toBe(false);
  });
  it('isIso8601 accepts schema.org reduced precision (year, year-month)', () => {
    expect(isIso8601('2026')).toBe(true);
    expect(isIso8601('2026-06')).toBe(true);
    expect(isIso8601('2026-13')).toBe(false); // month out of range
    expect(isIso8601('2026-00')).toBe(false);
  });
  it('isIso8601 reads the full date-time grammar', () => {
    for (const ok of [
      ' 2026-06-26 ',
      '2026-12',
      '2026-06-26T10:00Z',
      '2026-06-26T10:00:00',
      '2026-06-26T10:00:00.123Z',
      '2026-06-26T10:00:00+09:00',
      '2026-06-26T10:00:00-05:30',
      '2026-06-26T23:59:59Z'
    ]) {
      expect(isIso8601(ok), ok).toBe(true);
    }
    for (const bad of [
      '2026/06/26',
      'v2026',
      '2026-06-26junk',
      '2026-06-26T10:60Z',
      '2026-06-26T10:00:60Z',
      '2026-06-26T25:00Z'
    ]) {
      expect(isIso8601(bad), bad).toBe(false);
    }
  });
  it('isIso8601 rejects impossible calendar dates/times', () => {
    expect(isIso8601('2026-13-40')).toBe(false); // month/day out of range
    expect(isIso8601('2026-02-31')).toBe(false); // Feb 31 doesn't exist
    expect(isIso8601('2026-06-26T25:00:00Z')).toBe(false); // hour out of range
  });
  it('hasPlaceholder', () => {
    expect(hasPlaceholder('Lorem ipsum dolor')).toBe(true);
    expect(hasPlaceholder('Your Company Name')).toBe(true);
    expect(hasPlaceholder('Acme Corp')).toBe(false);
  });
  it('nodeStringValues collects nested + array strings (so seo/json-ld-placeholder sees publisher.name etc.)', () => {
    const node = { name: 'Acme', publisher: { name: 'Your Company Name' }, sameAs: ['https://a.test'] };
    expect(nodeStringValues(node)).toEqual(['Acme', 'Your Company Name', 'https://a.test']);
  });
  it('nodeStringValues skips null values', () => {
    expect(nodeStringValues({ a: null, b: 'x' })).toEqual(['x']);
  });
});

describe('hasNonEmpty', () => {
  it('treats empty/blank values as missing', () => {
    expect(hasNonEmpty({ headline: 'x' }, 'headline')).toBe(true);
    expect(hasNonEmpty({ headline: '' }, 'headline')).toBe(false);
    expect(hasNonEmpty({ headline: '   ' }, 'headline')).toBe(false);
    expect(hasNonEmpty({ headline: null }, 'headline')).toBe(false);
    expect(hasNonEmpty({}, 'headline')).toBe(false);
    expect(hasNonEmpty({ itemListElement: [] }, 'itemListElement')).toBe(false);
    expect(hasNonEmpty({ itemListElement: [{}] }, 'itemListElement')).toBe(true);
    expect(hasNonEmpty({ offers: {} }, 'offers')).toBe(true); // a non-empty object counts
  });
});
