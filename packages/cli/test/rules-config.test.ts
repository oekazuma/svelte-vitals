import { describe, it, expect } from 'vitest';
import { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from '../src/rules-config.js';

describe('buildRulesConfig', () => {
  it('an allow-list disables every rule not listed', () => {
    const cfg = buildRulesConfig(['seo/title-presence'], []);
    expect(cfg['seo/title-presence']).toBeUndefined();
    expect(cfg['seo/description-presence']).toBe('off');
    expect(cfg['seo/html-lang']).toBe('off');
  });

  it('an ignore-list disables only the listed rules', () => {
    expect(buildRulesConfig([], ['seo/description-presence', 'seo/canonical-url'])).toEqual({ 'seo/description-presence': 'off', 'seo/canonical-url': 'off' });
  });

  it('deny wins over allow', () => {
    const cfg = buildRulesConfig(['seo/title-presence'], ['seo/title-presence']);
    expect(cfg['seo/title-presence']).toBe('off');
  });

  it('returns an empty config when no flags are given', () => {
    expect(buildRulesConfig([], [])).toEqual({});
  });
});

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
