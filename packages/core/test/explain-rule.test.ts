import { describe, it, expect } from 'vitest';
import { explainRule, allRules } from '../src/index.js';

describe('explainRule', () => {
  it('returns info for a known rule id', () => {
    const info = explainRule('SEO001');
    expect(info).toBeDefined();
    expect(info!.id).toBe('SEO001');
    expect(info!.severity).toBe('critical');
    expect(info!.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
    expect(info!.rationale.length).toBeGreaterThan(0);
    expect(info!.fix?.description.length).toBeGreaterThan(0);
  });

  it('resolves a rule id case-insensitively and returns the canonical id', () => {
    const info = explainRule('seo001');
    expect(info).toBeDefined();
    expect(info!.id).toBe('SEO001');
    expect(info!.docsUrl).toBe('https://svelte-vitals.dev/rules/SEO001');
  });

  it('returns undefined for an unknown id', () => {
    expect(explainRule('NOPE999')).toBeUndefined();
  });

  it('every built-in rule has a non-empty rationale and a derivable docs url', () => {
    for (const rule of allRules) {
      const info = explainRule(rule.id);
      expect(info, rule.id).toBeDefined();
      expect(info!.rationale.length, `${rule.id} rationale`).toBeGreaterThan(0);
      expect(info!.docsUrl).toBe(`https://svelte-vitals.dev/rules/${rule.id}`);
    }
  });
});
