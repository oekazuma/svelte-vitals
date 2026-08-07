import { describe, it, expect } from 'vitest';
import { findUnknownRuleIds, knownRuleIds } from '../src/rules-config.js';

describe('findUnknownRuleIds', () => {
  it('flags ids that are not part of the registry (typos)', () => {
    expect(findUnknownRuleIds(['seo/title-presence', 'SEO999', 'nope'])).toEqual(['SEO999', 'nope']);
  });

  it('returns nothing when all ids are known', () => {
    expect(findUnknownRuleIds(['seo/title-presence', 'seo/html-lang'])).toEqual([]);
  });

  it('deduplicates repeated unknown ids', () => {
    expect(findUnknownRuleIds(['SEO999', 'SEO999'])).toEqual(['SEO999']);
  });
});

describe('knownRuleIds', () => {
  it('lists the built-in ids sorted', () => {
    const ids = knownRuleIds();
    expect(ids).toContain('seo/title-presence');
    expect(ids).toEqual([...ids].sort());
  });
});
