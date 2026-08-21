import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/types.js';
import { selectRules, configuredSeverity } from '../src/config-apply.js';
import { buildInventory, pairKey } from '../src/scoring/inventory.js';
import type { Rule } from '../src/rule.js';

const check = async (): Promise<Result[]> => [];
const onRule: Rule = {
  id: 'a11y/x-on',
  title: 'x',
  category: 'a11y',
  severity: 'info',
  scope: 'route',
  rationale: 'r',
  check
};
const offRule: Rule = { ...onRule, id: 'a11y/x-off', defaultOff: true };

describe('defaultOff selection and inventory', () => {
  it('a defaultOff rule is not selected and carries no weight without a config entry', () => {
    const config = defineConfig({});
    expect(selectRules([onRule, offRule], config).map((r) => r.id)).toEqual(['a11y/x-on']);
    expect(configuredSeverity(offRule, config)).toBeUndefined();
    const inv = buildInventory(config, [offRule]);
    expect(inv.get(pairKey('a11y', 'route'))).toBeUndefined();
  });

  it('any explicit entry enables it — severity string or options object', () => {
    const bySeverity = defineConfig({ rules: { 'a11y/x-off': 'warning' } });
    expect(selectRules([offRule], bySeverity).map((r) => r.id)).toEqual(['a11y/x-off']);
    expect(configuredSeverity(offRule, bySeverity)).toBe('warning');
    const byObject = defineConfig({ rules: { 'a11y/x-off': { options: {} } } });
    expect(selectRules([offRule], byObject).map((r) => r.id)).toEqual(['a11y/x-off']);
    expect(configuredSeverity(offRule, byObject)).toBe('info');
    expect(buildInventory(byObject, [offRule]).get(pairKey('a11y', 'route'))).toBe(1);
  });

  it("an explicit 'off' still turns it off", () => {
    const config = defineConfig({ rules: { 'a11y/x-off': 'off' } });
    expect(selectRules([offRule], config)).toEqual([]);
    expect(configuredSeverity(offRule, config)).toBeUndefined();
  });
});
