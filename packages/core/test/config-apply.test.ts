import { describe, it, expect } from 'vitest';
import {
  selectRules,
  applyRuleSeverities,
  applyOverrides,
  compileOverrides,
  overrideMatches,
  defineConfig,
  type Rule,
  type Result
} from '../src/index.js';

const ruleA = {
  id: 'seo/title-presence',
  title: 't',
  category: 'seo',
  severity: 'critical',
  scope: 'route',
  rationale: 'r',
  check: async () => []
} as Rule;
const ruleB = {
  id: 'seo/json-ld',
  title: 't',
  category: 'seo',
  severity: 'info',
  scope: 'route',
  rationale: 'r',
  check: async () => []
} as Rule;

describe('config application', () => {
  it('drops rules set to off', () => {
    const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { 'seo/json-ld': 'off' } }));
    expect(kept.map((r) => r.id)).toEqual(['seo/title-presence']);
  });
  it('overrides result severity', () => {
    const results: Result[] = [
      { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    const out = applyRuleSeverities(results, defineConfig({ rules: { 'seo/canonical-url': 'critical' } }));
    expect(out[0]!.severity).toBe('critical');
  });
  it('leaves results unchanged when no override', () => {
    const results: Result[] = [
      { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    expect(applyRuleSeverities(results, defineConfig({}))[0]!.severity).toBe('warning');
  });
  it('drops rules disabled through the object form', () => {
    const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { 'seo/json-ld': { severity: 'off' } } }));
    expect(kept.map((r) => r.id)).toEqual(['seo/title-presence']);
  });
  it('keeps rules whose object form only carries options', () => {
    const kept = selectRules([ruleA, ruleB], defineConfig({ rules: { 'seo/json-ld': { options: { max: 3 } } } }));
    expect(kept.map((r) => r.id)).toEqual(['seo/title-presence', 'seo/json-ld']);
  });
  it('overrides severity through the object form', () => {
    const results: Result[] = [
      { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    const out = applyRuleSeverities(
      results,
      defineConfig({ rules: { 'seo/canonical-url': { severity: 'critical' } } })
    );
    expect(out[0]!.severity).toBe('critical');
  });
  it('leaves severity alone when the object form carries only options', () => {
    const results: Result[] = [
      { id: 'seo/canonical-url', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'x' }
    ];
    const out = applyRuleSeverities(results, defineConfig({ rules: { 'seo/canonical-url': { options: { max: 1 } } } }));
    expect(out[0]!.severity).toBe('warning');
  });
  it('applyOverrides: an options-only entry does not clear a severity set by an earlier matching entry', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'x',
        route: '/dashboard'
      }
    ];
    const config = defineConfig({
      overrides: [
        { route: '/dashboard', rules: { 'seo/title-presence': { severity: 'critical' } } },
        { route: '/dashboard', rules: { 'seo/title-presence': { options: { max: 4 } } } }
      ]
    });
    const out = applyOverrides(results, config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('critical');
  });
  it('applyOverrides: the object form with severity off removes the result, like the bare string', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'x',
        route: '/dashboard'
      }
    ];
    const config = defineConfig({
      overrides: [{ route: '/dashboard', rules: { 'seo/title-presence': { severity: 'off' } } }]
    });
    expect(applyOverrides(results, config)).toEqual([]);
  });
  it('applyOverrides: an options-only entry as the sole match leaves severity untouched', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'x',
        route: '/dashboard'
      }
    ];
    const config = defineConfig({
      overrides: [{ route: '/dashboard', rules: { 'seo/title-presence': { options: { max: 4 } } } }]
    });
    const out = applyOverrides(results, config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('warning');
  });
  it('applyOverrides: an options-only rule-id key does not shadow a category severity (Finding 2)', () => {
    const results: Result[] = [
      {
        id: 'architecture/prop-count',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'x',
        location: 'src/lib/Button.svelte'
      }
    ];
    const config = defineConfig({
      overrides: [
        {
          files: 'src/lib/**',
          rules: { architecture: 'critical', 'architecture/prop-count': { options: { max: 4 } } }
        }
      ]
    });
    const out = applyOverrides(results, config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('critical');
  });
  it('applyOverrides: a category key carrying only { severity } in object form still applies', () => {
    const results: Result[] = [
      {
        id: 'seo/title-presence',
        category: 'seo',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'x',
        route: '/dashboard'
      }
    ];
    const config = defineConfig({
      overrides: [{ route: '/dashboard', rules: { seo: { severity: 'critical' } } }]
    });
    const out = applyOverrides(results, config);
    expect(out).toHaveLength(1);
    expect(out[0]!.severity).toBe('critical');
  });
});

describe('override matching', () => {
  const config = defineConfig({
    overrides: [{ files: 'src/lib/**', rules: { 'architecture/prop-count': 'off' } }]
  });
  it('matches a file under the glob', () => {
    const [o] = compileOverrides(config);
    expect(overrideMatches(o!, { file: 'src/lib/Button.svelte' })).toBe(true);
  });
  it('does not match a file outside the glob', () => {
    const [o] = compileOverrides(config);
    expect(overrideMatches(o!, { file: 'src/routes/+page.svelte' })).toBe(false);
  });
  it('matches on route when only a route target is given', () => {
    const [o] = compileOverrides(defineConfig({ overrides: [{ route: '/admin/**', rules: { seo: 'off' } }] }));
    expect(overrideMatches(o!, { route: '/admin/users' })).toBe(true);
    expect(overrideMatches(o!, { route: '/about' })).toBe(false);
  });
  it('returns an empty list when the config has no overrides', () => {
    expect(compileOverrides(defineConfig({}))).toEqual([]);
  });
});
