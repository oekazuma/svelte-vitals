import { describe, expect, it } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { defaultProject, runAnalysis, type Rule, type RuleContext } from '../src/internal.js';

const finding: Result = {
  id: 'seo/title-presence',
  severity: 'warning',
  detection: { presence: 'own', value: 'static' },
  route: '/',
  message: 'm'
};

const okRule: Rule = {
  id: 'seo/title-presence',
  title: 't',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale: 'r',
  check: async () => [finding]
};

const crashingRule: Rule = {
  id: 'seo/charset',
  title: 't',
  category: 'seo',
  severity: 'warning',
  scope: 'route',
  rationale: 'r',
  check: async () => {
    throw new Error('boom');
  }
};

const ctxFor = (config = defineConfig({})): RuleContext => ({ heads: [], project: defaultProject, config });

describe('runAnalysis', () => {
  it('applies configured severities to the raw results', async () => {
    const config = defineConfig({ rules: { 'seo/title-presence': 'critical' } });
    const { results } = await runAnalysis([okRule], ctxFor(config), new Map());
    expect(results.map((r) => r.severity)).toEqual(['critical']);
  });

  it('an empty directive index leaves results untouched', async () => {
    const { results } = await runAnalysis([okRule], ctxFor(), new Map());
    expect(results).toEqual([finding]);
  });

  it('an empty directive index leaves a penalized finding untouched too', async () => {
    // The dev handle relies on this branch: penalized findings take the directive-lookup path.
    const penalized: Result = { ...finding, detection: { presence: 'none', value: 'absent' } };
    const failingRule: Rule = { ...okRule, check: async () => [penalized] };
    const { results } = await runAnalysis([failingRule], ctxFor(), new Map());
    expect(results).toEqual([penalized]);
  });

  it('turns a crashed rule off in the returned scoring config', async () => {
    const { results, failedRules, failedRuleIds, scoringConfig } = await runAnalysis(
      [okRule, crashingRule],
      ctxFor(),
      new Map()
    );
    expect(results).toEqual([finding]);
    expect(failedRules).toEqual([{ id: 'seo/charset', message: 'boom' }]);
    expect(failedRuleIds).toEqual(['seo/charset']);
    expect(scoringConfig.rules['seo/charset']).toBe('off');
  });
});
