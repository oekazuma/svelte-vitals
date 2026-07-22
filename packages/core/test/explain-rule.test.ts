import { describe, it, expect } from 'vitest';
import { explainRule, allRules } from '../src/index.js';

describe('explainRule', () => {
  it('returns info for a known rule id', () => {
    const info = explainRule('seo/title-presence');
    expect(info).toBeDefined();
    expect(info!.id).toBe('seo/title-presence');
    expect(info!.severity).toBe('critical');
    expect(info!.docsUrl).toBe('https://oekazuma.github.io/svelte-vitals/rules/seo/title-presence');
    expect(info!.rationale.length).toBeGreaterThan(0);
    expect(info!.fix?.description.length).toBeGreaterThan(0);
  });

  it('does not match a rule id with the wrong case (exact match only)', () => {
    expect(explainRule('SEO/TITLE-PRESENCE')).toBeUndefined();
  });

  it('returns undefined for an unknown id', () => {
    expect(explainRule('NOPE999')).toBeUndefined();
  });

  it('every built-in rule has a non-empty rationale and a derivable docs url', () => {
    for (const rule of allRules) {
      const info = explainRule(rule.id);
      expect(info, rule.id).toBeDefined();
      expect(info!.rationale.length, `${rule.id} rationale`).toBeGreaterThan(0);
      expect(info!.docsUrl).toBe(`https://oekazuma.github.io/svelte-vitals/rules/${rule.id.toLowerCase()}`);
    }
  });
});
