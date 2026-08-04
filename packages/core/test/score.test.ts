// Scores are floored, not rounded (2026-07-31): a displayed 100 means the deduction was exactly zero.
import { describe, it, expect } from 'vitest';
import { computeScore, defineConfig, scoresByCategory, type Result } from '../src/index.js';
import type { Rule } from '../src/rule.js';

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

const r = (id: string, category: Rule['category'], scope: Rule['scope'], severity: Rule['severity']) =>
  ({ id, category, scope, severity, title: id, rationale: '', check: async () => [] }) as unknown as Rule;

// Nine weight in one pair — the shape that makes the arithmetic below checkable by hand.
const PERF = [
  r('p/i1', 'performance', 'component', 'info'),
  r('p/i2', 'performance', 'component', 'info'),
  r('p/i3', 'performance', 'component', 'info'),
  r('p/i4', 'performance', 'component', 'info'),
  r('p/w1', 'performance', 'component', 'warning')
];

describe('computeScore — proportional model', () => {
  const config = defineConfig({});

  it('scores a key as the share of its pair that is intact', () => {
    // failedWeight 5 of inventory 9 -> 100 - 500/9 = 44.44…, floored once at the category.
    const results = [fail('p/w1', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF });
    expect(score).toBe(44);
  });

  it('lets a key reach 0 when everything in its pair fails', () => {
    const results = PERF.map((rule) => fail(rule.id, 'src/A.svelte', rule.severity as 'warning' | 'info'));
    expect(computeScore(results, config, { rules: PERF, applyCriticalCap: false }).score).toBe(0);
  });

  it('distinguishes one affected key from many', () => {
    // The reported symptom: under the old model both displayed 99.
    const keys = Array.from({ length: 585 }, (_, i) => `src/${i}.svelte`);
    const one = keys.map((k, i) => (i === 0 ? fail('p/i1', k, 'info') : pass('p/i1', k)));
    const many = keys.map((k, i) => (i < 276 ? fail('p/i1', k, 'info') : pass('p/i1', k)));
    const a = computeScore(one, config, { rules: PERF }).score;
    const b = computeScore(many, config, { rules: PERF }).score;
    expect(a).toBe(99);
    expect(b).toBeLessThan(a);
  });

  it('sums the inventory over every pair observed on a key', () => {
    // One seo route warning beside a passing performance route rule: 100 - 500/(5+5) = 50,
    // where the seo pair alone would give 100 - 500/5 = 0.
    const rules = [r('seo/x', 'seo', 'route', 'warning'), r('perf/y', 'performance', 'route', 'warning')];
    const results = [fail('seo/x', '/a', 'warning'), pass('perf/y', '/a')];
    expect(computeScore(results, defineConfig({}), { rules }).score).toBe(50);
  });

  it('keeps an integral score integral', () => {
    // 100 - (100*88)/110 is exactly 20; 100 * (1 - 88/110) is 19.999999999999996.
    const rules = [
      r('s/c1', 'seo', 'route', 'critical'),
      r('s/c2', 'seo', 'route', 'critical'),
      ...Array.from({ length: 14 }, (_, i) => r(`s/w${i}`, 'seo', 'route', 'warning')),
      ...Array.from({ length: 10 }, (_, i) => r(`s/i${i}`, 'seo', 'route', 'info'))
    ];
    // 2 criticals (30) + 11 warnings (55) + 3 infos (3) = 88, against an inventory of 110.
    const results = [
      fail('s/c1', '/a', 'critical'),
      fail('s/c2', '/a', 'critical'),
      ...Array.from({ length: 11 }, (_, i) => fail(`s/w${i}`, '/a', 'warning')),
      ...Array.from({ length: 3 }, (_, i) => fail(`s/i${i}`, '/a', 'info'))
    ];
    expect(computeScore(results, defineConfig({}), { rules, applyCriticalCap: false }).score).toBe(20);
  });

  it('keeps an integral mean integral across keys', () => {
    // Two keys, deficits 300/9 and 600/9, true mean exactly 50. A mean of key scores gives
    // 49.99999999999999 and displays 49.
    const results = [
      fail('p/i1', 'src/A.svelte', 'info'),
      fail('p/i2', 'src/A.svelte', 'info'),
      fail('p/i3', 'src/A.svelte', 'info'),
      fail('p/w1', 'src/B.svelte', 'warning'),
      fail('p/i1', 'src/B.svelte', 'info')
    ];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(50);
  });

  it('scores 0, not NaN, for a penalized result whose rule is not in the inventory', () => {
    const results = [fail('ghost/rule', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF, applyCriticalCap: false });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(0);
  });

  it('scores 100 for a key whose only results come from rules outside the inventory', () => {
    const results = [pass('ghost/rule', 'src/A.svelte')];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(100);
  });

  it('narrowing the rule set to one category leaves that category unchanged', () => {
    const mixed = [...PERF, r('seo/x', 'seo', 'route', 'warning')];
    const results = [fail('p/w1', 'src/A.svelte', 'warning'), pass('p/i1', 'src/A.svelte')];
    expect(computeScore(results, config, { rules: mixed }).score).toBe(
      computeScore(results, config, { rules: PERF }).score
    );
  });

  it('keeps a category with two scopes from merging them', () => {
    // A component key must not be measured against route-scoped rules it can never trigger.
    // Merged, the inventory would be 5 + 45 and the key would score 90 instead of 0.
    const rules = [
      r('p/comp', 'performance', 'component', 'warning'),
      ...Array.from({ length: 9 }, (_, i) => r(`p/route${i}`, 'performance', 'route', 'warning'))
    ];
    const results = [fail('p/comp', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules, applyCriticalCap: false }).score).toBe(0);
  });

  it('scores 100 when nothing is penalized', () => {
    const results = [pass('p/i1', 'src/A.svelte'), pass('p/w1', 'src/B.svelte')];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(100);
  });

  it('orders severities within one pair', () => {
    const one = (id: string, sev: 'critical' | 'warning' | 'info') =>
      computeScore([fail(id, 'src/A.svelte', sev)], config, {
        rules: [
          r('x/c', 'security', 'component', 'critical'),
          r('x/w', 'security', 'component', 'warning'),
          r('x/i', 'security', 'component', 'info')
        ],
        applyCriticalCap: false
      }).score;
    expect(one('x/c', 'critical')).toBeLessThan(one('x/w', 'warning'));
    expect(one('x/w', 'warning')).toBeLessThan(one('x/i', 'info'));
  });
});
