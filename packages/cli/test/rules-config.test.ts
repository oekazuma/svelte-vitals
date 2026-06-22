import { describe, it, expect } from 'vitest';
import { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from '../src/rules-config.js';

describe('buildRulesConfig', () => {
  it('an allow-list disables every rule not listed', () => {
    const cfg = buildRulesConfig(['SEO001'], []);
    expect(cfg.SEO001).toBeUndefined();
    expect(cfg.SEO002).toBe('off');
    expect(cfg.SEO009).toBe('off');
  });

  it('an ignore-list disables only the listed rules', () => {
    expect(buildRulesConfig([], ['SEO002', 'SEO003'])).toEqual({ SEO002: 'off', SEO003: 'off' });
  });

  it('deny wins over allow', () => {
    const cfg = buildRulesConfig(['SEO001'], ['SEO001']);
    expect(cfg.SEO001).toBe('off');
  });

  it('returns an empty config when no flags are given', () => {
    expect(buildRulesConfig([], [])).toEqual({});
  });
});

describe('findUnknownRuleIds', () => {
  it('flags ids that are not part of the registry (typos)', () => {
    expect(findUnknownRuleIds(['SEO001', 'SEO999', 'nope'])).toEqual(['SEO999', 'nope']);
  });

  it('returns nothing when all ids are known', () => {
    expect(findUnknownRuleIds(['SEO001', 'SEO009'])).toEqual([]);
  });

  it('deduplicates repeated unknown ids', () => {
    expect(findUnknownRuleIds(['SEO999', 'SEO999'])).toEqual(['SEO999']);
  });
});

describe('knownRuleIds', () => {
  it('lists the built-in ids sorted', () => {
    const ids = knownRuleIds();
    expect(ids).toContain('SEO001');
    expect(ids).toEqual([...ids].sort());
  });
});

describe('findUnknownRuleIds a11y', () => {
  it('treats a11y_* codes as known rule ids', () => {
    expect(findUnknownRuleIds(['a11y_missing_attribute'])).toEqual([]);
    // a genuinely unknown id is still reported
    expect(findUnknownRuleIds(['NOPE999'])).toEqual(['NOPE999']);
  });
});
