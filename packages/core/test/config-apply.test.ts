import { describe, it, expect } from 'vitest';
import { selectRules, applyRuleSeverities, defineConfig, type Rule, type Result } from '../src/index.js';

const ruleA = {
  id: 'SEO001',
  title: 't',
  category: 'seo',
  severity: 'critical',
  scope: 'route',
  check: async () => []
} as Rule;
const ruleB = {
  id: 'SEO008',
  title: 't',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  check: async () => []
} as Rule;

describe('config application', () => {
  it('drops rules set to off', () => {
    const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { SEO008: 'off' } }));
    expect(kept.map((r) => r.id)).toEqual(['SEO001']);
  });
  it('overrides result severity', () => {
    const results: Result[] = [
      { id: 'SEO003', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    const out = applyRuleSeverities(results, defineConfig({ rules: { SEO003: 'critical' } }));
    expect(out[0]!.severity).toBe('critical');
  });
  it('leaves results unchanged when no override', () => {
    const results: Result[] = [
      { id: 'SEO003', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    expect(applyRuleSeverities(results, defineConfig({}))[0]!.severity).toBe('warning');
  });
});
