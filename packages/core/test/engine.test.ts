import { describe, expect, it } from 'vitest';
import { runRules } from '../src/engine.js';
import type { Rule, RuleContext } from '../src/rule.js';

const ctx = { heads: [], project: {}, config: { rules: {} } } as unknown as RuleContext;

function ruleThatCounts(id: string, counts: Record<string, number>): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check(c: RuleContext) {
      c.recordExamined?.(counts);
      return [];
    }
  } as unknown as Rule;
}

function ruleThatDoesNot(id: string): Rule {
  return {
    id,
    title: id,
    category: 'architecture',
    severity: 'info',
    scope: 'component',
    rationale: '',
    async check() {
      return [];
    }
  } as unknown as Rule;
}

describe('runRules examined counts', () => {
  it('keys a rule’s counts by its id', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { 'x → y': 3 })], ctx);
    expect(examined).toEqual({ 'a/one': { 'x → y': 3 } });
  });

  it('gives a rule that reports nothing no entry at all', async () => {
    const { examined } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(Object.hasOwn(examined, 'a/two')).toBe(false);
  });

  it('keeps two rules’ counts apart', async () => {
    const { examined } = await runRules([ruleThatCounts('a/one', { g: 1 }), ruleThatCounts('a/two', { g: 2 })], ctx);
    expect(examined).toEqual({ 'a/one': { g: 1 }, 'a/two': { g: 2 } });
  });

  it('still returns the results', async () => {
    const { results } = await runRules([ruleThatDoesNot('a/two')], ctx);
    expect(results).toEqual([]);
  });
});
