import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import {
  isPenalized,
  effectiveSeverity,
  summarize,
  runRules,
  seoTitlePresence,
  defaultConfig,
  defaultProject,
  type ResolvedHead
} from '../src/internal.js';

const dynResult: Result = {
  id: 'seo/title-presence',
  severity: 'critical',
  detection: { presence: 'own', value: 'dynamic' },
  route: '/x',
  message: '<title>'
};

describe('treatDynamicAs handling', () => {
  it('does not penalize dynamic under pass', () => {
    expect(isPenalized(dynResult.detection, 'pass')).toBe(false);
  });
  it('penalizes dynamic under warn and fail', () => {
    expect(isPenalized(dynResult.detection, 'warn')).toBe(true);
    expect(isPenalized(dynResult.detection, 'fail')).toBe(true);
  });
  it('effective severity downgrades dynamic to warning under warn', () => {
    expect(effectiveSeverity(dynResult, defineConfig({ treatDynamicAs: 'warn' }))).toBe('warning');
    expect(effectiveSeverity(dynResult, defineConfig({ treatDynamicAs: 'fail' }))).toBe('critical');
  });
  it('summarize buckets a warn-dynamic finding as a warning', () => {
    const s = summarize([dynResult], defineConfig({ treatDynamicAs: 'warn' }));
    expect(s.warning).toBe(1);
    expect(s.critical).toBe(0);
  });
});

describe('summarize over a real rule run', () => {
  const titleHead = (route: string, value?: 'static' | 'dynamic'): ResolvedHead => ({
    route,
    file: `src/routes${route}/+page.svelte`,
    source: 'static',
    tags: value ? [{ kind: 'title', presence: 'own', value }] : []
  });

  it('summarizes a mixed project', async () => {
    const { results } = await runRules([seoTitlePresence], {
      heads: [titleHead('/static', 'static'), titleHead('/dynamic', 'dynamic'), titleHead('/none')],
      project: defaultProject,
      config: defaultConfig
    });
    expect(summarize(results, defaultConfig)).toEqual({ critical: 1, warning: 0, info: 0, passed: 2, dynamic: 1 });
  });
});
