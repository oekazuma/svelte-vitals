// Scores are floored, not rounded (2026-07-31): a displayed 100 means the deduction was exactly zero.
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
    expect(scoreModel.routeAverage).toBe(94); // (100*4 + 74)/5 = 94.8 -> floor 94
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

const CONFIG = defineConfig({});

/** `keys` route keys, the first `findings` of them carrying one `info` finding. */
const spread = (keys: number, findings: number): Result[] =>
  Array.from({ length: keys }, (_, i) => ({
    id: 'seo/title-presence',
    category: 'seo' as const,
    severity: 'info' as const,
    detection:
      i < findings
        ? { presence: 'none' as const, value: 'absent' as const }
        : { presence: 'own' as const, value: 'static' as const },
    route: `/k${i}`,
    message: 'm',
    recommendation: 'r'
  }));

describe('computeScore — a displayed 100 means zero deduction', () => {
  it('shows 99, not 100, for a single info finding among many passes', () => {
    // The reported bug: 276 findings over 585 keys rounded to a perfect 100.
    expect(computeScore(spread(585, 276), CONFIG).score).toBe(99);
    expect(computeScore(spread(585, 1), CONFIG).score).toBe(99);
  });

  it('shows 100 only when nothing was deducted', () => {
    expect(computeScore(spread(585, 0), CONFIG).score).toBe(100);
    expect(computeScore([], CONFIG).score).toBe(100);
  });

  it('floors a mean of exactly 99.5 down to 99', () => {
    // 200 keys, 100 of them with one info → mean 99.5. `Math.round` gave 100.
    expect(computeScore(spread(200, 100), CONFIG).score).toBe(99);
  });

  it('exposes the unrounded score alongside the floored one', () => {
    const r = computeScore(spread(585, 276), CONFIG);
    expect(r.score).toBe(99);
    expect(r.rawScore).toBeCloseTo(99.528, 3);
  });

  it('floors routeAverage too, keeping score = routeAverage - sitePenalty when neither cap nor clamp binds', () => {
    const results: Result[] = [
      ...spread(200, 100),
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots.txt',
        recommendation: 'r'
      }
    ];
    const r = computeScore(results, CONFIG);
    expect(r.scoreModel.routeAverage).toBe(99);
    expect(r.scoreModel.sitePenalty).toBe(5);
    expect(r.score).toBe(r.scoreModel.routeAverage - r.scoreModel.sitePenalty);
  });

  it('decides the cap on the raw value, not the floored one', () => {
    // 10 keys, sitePenalty 0. Keys 0-8: a critical + a warning on two distinct rule ids
    // (deduction 15+5=20, route score 80). Key 9: a critical + a warning + an info on three
    // distinct rule ids (deduction 15+5+1=21, route score 79). Distinct ids per key so the
    // deductions sum instead of only the max of duplicates counting.
    // Mean = (9*80 + 79)/10 = 79.9.
    //   Deciding on the raw value: 79.9 > 79 -> cap binds -> rawScore 79, criticalCap 79.
    //   Deciding on the floored value: floor(79.9) - 0 = 79 -> 79 > 79 is false -> no cap ->
    //   rawScore would stay 79.9 and criticalCap null. Displayed `score` is 79 either way (floor(79.9)
    //   is also 79), which is why this test must assert on rawScore/criticalCap, not on score.
    const results: Result[] = Array.from({ length: 10 }, (_, i) => {
      const route = `/k${i}`;
      const findings: Result[] = [
        {
          id: 'seo/title-presence',
          category: 'seo' as const,
          severity: 'critical' as const,
          detection: { presence: 'none' as const, value: 'absent' as const },
          route,
          message: 'm',
          recommendation: 'r'
        },
        {
          id: 'seo/description-presence',
          category: 'seo' as const,
          severity: 'warning' as const,
          detection: { presence: 'none' as const, value: 'absent' as const },
          route,
          message: 'm',
          recommendation: 'r'
        }
      ];
      if (i === 9) {
        findings.push({
          id: 'seo/canonical-url',
          category: 'seo' as const,
          severity: 'info' as const,
          detection: { presence: 'none' as const, value: 'absent' as const },
          route,
          message: 'm',
          recommendation: 'r'
        });
      }
      return findings;
    }).flat();

    const r = computeScore(results, CONFIG);
    expect(r.score).toBe(79);
    expect(r.rawScore).toBe(79);
    expect(r.scoreModel.criticalCap).toBe(79);
  });
});
