import { describe, it, expect } from 'vitest';
import { computeScore, defineConfig, scoresByCategory, type Result } from '../src/index.js';

const pass = (id: string, route: string): Result => ({
  id,
  severity: 'critical',
  detection: { presence: 'own', value: 'static' },
  route,
  message: 'ok'
});
const fail = (id: string, route: string, severity: 'critical' | 'warning' | 'info'): Result => ({
  id,
  severity,
  detection: { presence: 'none', value: 'absent' },
  route,
  message: 'missing'
});

describe('computeScore (§12 worked example)', () => {
  it('caps at 79 when a critical exists and applies site penalty', () => {
    const results: Result[] = [
      pass('seo/title-presence', '/a'),
      pass('seo/title-presence', '/b'),
      pass('seo/title-presence', '/c'),
      pass('seo/title-presence', '/d'),
      // route /blog: critical + 2 warnings + 1 info  => 100-15-5-5-1 = 74
      fail('seo/description-presence', '/blog', 'critical'),
      fail('seo/canonical-url', '/blog', 'warning'),
      fail('seo/og-image', '/blog', 'warning'),
      fail('seo/json-ld', '/blog', 'info'),
      // project rule: robots.txt missing (warning) => site penalty 5
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots'
      }
    ];
    const { score, scoreModel } = computeScore(results, defineConfig({}));
    expect(scoreModel.routeAverage).toBe(95); // (100*4 + 74)/5 = 94.8 -> 95
    expect(scoreModel.sitePenalty).toBe(5);
    expect(scoreModel.criticalCap).toBe(79);
    expect(score).toBe(79);
  });

  it('no cap and full marks when everything passes', () => {
    const { score, scoreModel } = computeScore([pass('seo/title-presence', '/a')], defineConfig({}));
    expect(score).toBe(100);
    expect(scoreModel.criticalCap).toBeNull();
  });

  it('reports criticalCap null when the cap does not actually lower the score', () => {
    // /x: critical (15) + 5 warnings (25) => 100-40 = 60, already below the 79 cap.
    const results: Result[] = [
      fail('seo/description-presence', '/x', 'critical'),
      fail('seo/canonical-url', '/x', 'warning'),
      fail('seo/og-image', '/x', 'warning'),
      fail('seo/og-title', '/x', 'warning'),
      fail('seo/indexability', '/x', 'warning'),
      fail('seo/twitter-card', '/x', 'warning')
    ];
    const { score, scoreModel } = computeScore(results, defineConfig({}));
    expect(score).toBe(60);
    expect(scoreModel.criticalCap).toBeNull();
  });

  it('omits the critical cap for a single-route view when applyCriticalCap is false', () => {
    const results: Result[] = [
      {
        id: 'seo/description-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        message: 'missing'
      }
    ];
    expect(computeScore(results, defineConfig({})).score).toBe(79); // capped (default)
    expect(computeScore(results, defineConfig({}), { applyCriticalCap: false }).score).toBe(85); // uncapped: 100-15
  });

  it('deducts once per (route, rule) even if a rule emits duplicate penalized results', () => {
    const results: Result[] = [
      {
        id: 'seo/description-presence',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        message: 'a'
      },
      {
        id: 'seo/description-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        message: 'b'
      }
    ];
    // one deduction per (route, rule), taking the max (critical = 15) -> 100-15 = 85, uncapped view
    expect(computeScore(results, defineConfig({}), { applyCriticalCap: false }).score).toBe(85);
  });

  it('deducts once per project rule even if duplicated', () => {
    const results: Result[] = [
      { id: 'seo/robots-txt', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'a' },
      { id: 'seo/robots-txt', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'b' }
    ];
    // single route seeded at 100 not present; routeAverage falls back to 100; site penalty counted once (5) -> 95
    expect(computeScore(results, defineConfig({})).scoreModel.sitePenalty).toBe(5);
    expect(computeScore(results, defineConfig({})).score).toBe(95);
  });
});

describe('scoresByCategory', () => {
  it('scores each category independently', () => {
    const config = defineConfig({});
    const results = [
      {
        id: 'seo/title-presence',
        category: 'seo',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      },
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'y'
      },
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'own', value: 'static' },
        route: '/b',
        message: 'ok'
      }
    ] as const;
    const byCat = scoresByCategory(results as never, config);
    expect(byCat.seo).toBeDefined();
    expect(byCat.performance).toBeDefined();
    // SEO has a critical on its only route → capped/low; performance has one bad route and one clean route.
    expect(byCat.performance!.score).toBeGreaterThan(byCat.seo!.score);
  });

  it('treats a missing category as seo', () => {
    const config = defineConfig({});
    const byCat = scoresByCategory(
      [
        {
          id: 'seo/title-presence',
          severity: 'warning',
          detection: { presence: 'none', value: 'absent' },
          route: '/a',
          message: 'x'
        }
      ] as never,
      config
    );
    expect(byCat.seo).toBeDefined();
    expect(byCat.performance).toBeUndefined();
  });
});
