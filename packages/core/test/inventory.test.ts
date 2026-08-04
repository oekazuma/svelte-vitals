import { describe, it, expect } from 'vitest';
import { buildInventory, pairKey, ruleScopes } from '../src/scoring/inventory.js';
import { defineConfig } from '../src/types.js';
import { allRules } from '../src/rules/index.js';
import type { Rule } from '../src/rule.js';

const rule = (id: string, category: Rule['category'], scope: Rule['scope'], severity: Rule['severity']) =>
  ({ id, category, scope, severity, title: id, rationale: '', check: async () => [] }) as unknown as Rule;

describe('buildInventory', () => {
  it('sums DEDUCTION per (category, scope) pair', () => {
    const rules = [
      rule('a/one', 'architecture', 'component', 'info'),
      rule('a/two', 'architecture', 'component', 'warning'),
      rule('p/one', 'performance', 'route', 'critical')
    ];
    const inv = buildInventory(defineConfig({}), rules);
    expect(inv.get(pairKey('architecture', 'component'))).toBe(6);
    expect(inv.get(pairKey('performance', 'route'))).toBe(15);
    expect(inv.get(pairKey('performance', 'component'))).toBeUndefined();
  });

  it('drops a rule turned off and counts a rule whose severity is overridden', () => {
    const rules = [
      rule('a/one', 'architecture', 'component', 'info'),
      rule('a/two', 'architecture', 'component', 'info')
    ];
    const config = defineConfig({ rules: { 'a/one': 'off', 'a/two': 'critical' } });
    const inv = buildInventory(config, rules);
    expect(inv.get(pairKey('architecture', 'component'))).toBe(15);
  });

  it('defaults to the selected registry', () => {
    // Eight architecture rules, all info, is what makes the old model bottom out at 92.
    const inv = buildInventory(defineConfig({}));
    const architecture = allRules.filter((r) => r.category === 'architecture');
    expect(inv.get(pairKey('architecture', 'component'))).toBe(architecture.length);
  });

  it('maps a rule id to its pair', () => {
    const rules = [rule('a/one', 'architecture', 'component', 'info')];
    expect(ruleScopes(rules).get('a/one')).toBe(pairKey('architecture', 'component'));
    expect(ruleScopes(rules).get('nope')).toBeUndefined();
  });
});
