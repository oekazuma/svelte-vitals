// Scores are floored, not rounded (2026-07-31): a displayed 100 means the deduction was exactly zero.
import { describe, it, expect } from 'vitest';
import { computeScore, defineConfig, scoresByCategory, type Result } from '../src/index.js';
import type { Rule } from '../src/rule.js';
import { buildInventory } from '../src/scoring/inventory.js';

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
      // route /blog: critical(15) + warning(5) + warning(5) + info(1) = 26 failed, against the real
      // seo::route registry inventory (110) -> key score 100 - 2600/110 = 76.36...
      fail('seo/description-presence', '/blog', 'critical'),
      fail('seo/canonical-url', '/blog', 'warning'),
      fail('seo/og-image', '/blog', 'warning'),
      fail('seo/json-ld', '/blog', 'info'),
      // two distinct project rules, so sitePenalty below demonstrably sums (5 + 1) rather than
      // echoing a single deduction — the one field the proportional rewrite left untouched.
      {
        id: 'seo/robots-txt',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots'
      },
      {
        id: 'seo/sitemap-in-robots',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        message: 'no sitemap link'
      }
    ];
    const { score, scoreModel } = computeScore(results, defineConfig({}));
    expect(scoreModel.routeAverage).toBe(95); // (100*4 + 76.36..)/5 = 95.27 -> floor 95
    expect(scoreModel.sitePenalty).toBe(6); // DEDUCTION.warning + DEDUCTION.info = 5 + 1
    expect(scoreModel.criticalCap).toBe(79);
    expect(score).toBe(79);
  });

  it('no cap and full marks when everything passes', () => {
    const { score, scoreModel } = computeScore([pass('seo/title-presence', '/a')], defineConfig({}));
    expect(score).toBe(100);
    expect(scoreModel.criticalCap).toBeNull();
  });

  it('reports criticalCap null when the cap does not actually lower the score', () => {
    // /x: critical(15) + 5 warnings(5 each) = 40 failed, against inventory 110 -> key score
    // 100 - 4000/110 = 63.63, floored to 63 - well below the 79 cap.
    const results: Result[] = [
      fail('seo/description-presence', '/x', 'critical'),
      fail('seo/canonical-url', '/x', 'warning'),
      fail('seo/og-image', '/x', 'warning'),
      fail('seo/og-title', '/x', 'warning'),
      fail('seo/indexability', '/x', 'warning'),
      fail('seo/twitter-card', '/x', 'warning')
    ];
    const { score, scoreModel } = computeScore(results, defineConfig({}));
    expect(score).toBe(63);
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
    // uncapped: failed 15 of inventory 110 -> 100 - 1500/110 = 86.36, floored 86
    expect(computeScore(results, defineConfig({}), { applyCriticalCap: false }).score).toBe(86);
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
    // one deduction per (route, rule), taking the max (critical = 15) -> failed 15 of inventory 110
    // -> 100 - 1500/110 = 86.36, floored 86, uncapped view
    expect(computeScore(results, defineConfig({}), { applyCriticalCap: false }).score).toBe(86);
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

describe('scoresByCategory — scoring options', () => {
  const config = defineConfig({});
  // One failing `seo` critical on one route: the ratio gives 100 − 1500/110 = 86.36, the cap gives 79.
  const results = [fail('seo/title-presence', '/a', 'critical')];

  it('caps a category at 79 when called without options', () => {
    // computeHealth calls it this way and depends on a capped category pulling Health down.
    expect(scoresByCategory(results, config).seo!.score).toBe(79);
    expect(scoresByCategory(results, config).seo!.scoreModel.criticalCap).toBe(79);
  });

  it('leaves the category uncapped when the cap is switched off', () => {
    const sr = scoresByCategory(results, config, { applyCriticalCap: false }).seo!;
    expect(sr.score).toBe(86);
    expect(sr.scoreModel.criticalCap).toBeNull();
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
    // 276 keys fail (id in the real seo::route inventory, 110): 100 - (276*100/110)/585 = 99.571095571...
    expect(r.rawScore).toBeCloseTo(99.571, 3);
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
    // failedWeight 5 of inventory 9, floored to 25 -> 100 - 500/25 = 80.
    const results = [fail('p/w1', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF });
    expect(score).toBe(80);
  });

  it('keeps a floored pair from reaching 0 when everything in it fails', () => {
    // failedWeight 9 of inventory 9, floored to 25 -> 100 - 900/25 = 64: a fully failed small pair
    // still costs less than the whole key.
    const results = PERF.map((rule) => fail(rule.id, 'src/A.svelte', rule.severity as 'warning' | 'info'));
    expect(computeScore(results, config, { rules: PERF, applyCriticalCap: false }).score).toBe(64);
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
    // Two 30-point pairs (each ≥ 25, so the floor is a no-op): a seo::route warning beside a
    // passing performance::route rule sums to 60 -> 100 - 500/60 = 91, where the seo pair alone
    // would give 100 - 500/30 = 83. A third, unreferenced architecture::route rule shares the same
    // scope but a different category: it must not be pulled into the sum, so it also pins the
    // pairing to (category, scope), not scope alone.
    const seoRoute = [
      r('seo/x', 'seo', 'route', 'warning'),
      ...Array.from({ length: 25 }, (_, i) => r(`seo/fill${i}`, 'seo', 'route', 'info'))
    ]; // 5 + 25 = 30
    const perfRoute = [
      r('perf/y', 'performance', 'route', 'warning'),
      ...Array.from({ length: 25 }, (_, i) => r(`perf/fill${i}`, 'performance', 'route', 'info'))
    ]; // 5 + 25 = 30
    const rules = [...seoRoute, ...perfRoute, r('arch/unreferenced', 'architecture', 'route', 'warning')];
    const results = [fail('seo/x', '/a', 'warning'), pass('perf/y', '/a')];
    expect(computeScore(results, defineConfig({}), { rules }).score).toBe(91);
  });

  it('keeps an integral score integral', () => {
    // NOT load-bearing on its own: f = 88, i = 110 also displays 20 under both wrong evaluation
    // orders (100 * (1 - f/i) and 100 * (f/i)) — the deficit-space mean's subtraction happens to
    // cancel their fp error at this particular anchor. Kept only as a worked example alongside the
    // fixture below, which is the one that actually discriminates.
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

  it('scores 44 for failedWeight 28 against inventory 50', () => {
    // f = 28, i = 50: 100 - (100*28)/50 is exactly 44; both 100 * (1 - 28/50) and 100 * (28/50)
    // land on 43.99999999999999, displaying 43. Unlike the f=88/i=110 case above, this fixture
    // fails under either wrong evaluation order — delete this one, not that one, if one has to go.
    const rules = [
      r('s/c1', 'seo', 'route', 'critical'),
      ...Array.from({ length: 7 }, (_, i) => r(`s/w${i}`, 'seo', 'route', 'warning'))
    ]; // inventory: 15 + 7*5 = 50
    const results = [
      fail('s/c1', '/a', 'critical'),
      fail('s/w0', '/a', 'warning'),
      fail('s/w1', '/a', 'warning'),
      fail('s/w2', '/a', 'info'),
      fail('s/w3', '/a', 'info'),
      fail('s/w4', '/a', 'info')
    ]; // failed: 15 + 5+5 + 1+1+1 = 28
    expect(computeScore(results, defineConfig({}), { rules, applyCriticalCap: false }).score).toBe(44);
  });

  it('scores 50 for a two-key mean of failed weight 10 and 20 against an inventory of 30', () => {
    // Inventory 30 is already ≥ 25, so this anchors the deficit-space mean itself, not the floor:
    // deficits 1000/30 and 2000/30 average in deficit space to exactly 50. A mean of key scores
    // computes 49.99999999999999 for the same true 50 (verified against the formula, not the runner).
    const rules = Array.from({ length: 30 }, (_, i) => r(`p/i${i}`, 'performance', 'component', 'info'));
    const results = [
      ...Array.from({ length: 10 }, (_, i) => fail(`p/i${i}`, 'src/A.svelte', 'info')),
      ...Array.from({ length: 20 }, (_, i) => fail(`p/i${i}`, 'src/B.svelte', 'info'))
    ];
    expect(computeScore(results, defineConfig({}), { rules }).score).toBe(50);
  });

  it('keeps an integral mean integral across keys', () => {
    // Two keys, inventory 9 floored to 25: deficits 300/25 and 600/25, true mean exactly 82.
    const results = [
      fail('p/i1', 'src/A.svelte', 'info'),
      fail('p/i2', 'src/A.svelte', 'info'),
      fail('p/i3', 'src/A.svelte', 'info'),
      fail('p/w1', 'src/B.svelte', 'warning'),
      fail('p/i1', 'src/B.svelte', 'info')
    ];
    expect(computeScore(results, config, { rules: PERF }).score).toBe(82);
  });

  it('scores 80, not NaN, for a penalized result whose rule is not in the inventory', () => {
    // No pair observed for `ghost/rule`, so the denominator floors straight to 25: 100 - 500/25.
    const results = [fail('ghost/rule', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: PERF, applyCriticalCap: false });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(80);
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
    // Its own pair (5) floors to 25 -> score 80. Merged, the inventory would be 5 + 45 = 50
    // (above the floor) and the key would score 90 instead.
    const rules = [
      r('p/comp', 'performance', 'component', 'warning'),
      ...Array.from({ length: 9 }, (_, i) => r(`p/route${i}`, 'performance', 'route', 'warning'))
    ];
    const results = [fail('p/comp', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules, applyCriticalCap: false }).score).toBe(80);
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

describe('computeScore — inventory wiring to config (no rules option, real registry)', () => {
  it('a config severity override changes the default inventory, not just buildInventory in isolation', () => {
    // architecture::component is 8 info rules (inventory 8) by default. Raising one rule's severity
    // to 'warning' makes it 7 info + 1 warning = 12, floored to 25. Verified against the real
    // registry: a key failing that one rule (now 'warning', deduction 5) scores 100 - 500/25 = 80.
    const config = defineConfig({ rules: { 'architecture/component-size': 'warning' } });
    const results = [fail('architecture/component-size', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config).score).toBe(80);
  });
});

describe('computeScore — a disabled rule injected via options.rules', () => {
  it('scores 80 and finite for a rule turned off in config but still carried in options.rules', () => {
    // `computeScore` now runs `options.rules` through `selectRules` itself, so an `off` rule never
    // reaches the inventory or `pairOf`: its penalized result observes no pair, so the denominator
    // floors to 25 (not `failed`), and the key scores 80 (100 - 500/25) rather than NaN or a false 100.
    const rule = r('a/off', 'architecture', 'component', 'warning');
    const config = defineConfig({ rules: { 'a/off': 'off' } });
    const results = [fail('a/off', 'src/A.svelte', 'warning')];
    const { score } = computeScore(results, config, { rules: [rule] });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(80);
  });

  it('scores 96, matching the isolated case, when the off rule shares its pair with an enabled rule', () => {
    // Before `options.rules` was filtered, `buildInventory` dropped the off rule internally but
    // `ruleScopes` did not: charged against the enabled rule's own inventory of 5, the same failing
    // off rule scored 80 here and 0 when injected alone in its pair — an inconsistency for identical
    // input. Filtering both from the same list makes the off rule invisible to both: no pair is
    // observed either way, so the denominator floors to 25 and the info deduction (1) gives
    // 100 - 100/25 = 96 in both the isolated and the shared-pair case.
    const off = r('p/off', 'performance', 'component', 'info');
    const enabled = r('p/warn', 'performance', 'component', 'warning');
    const config = defineConfig({ rules: { 'p/off': 'off' } });
    const results = [fail('p/off', 'src/A.svelte', 'info')];
    const { score } = computeScore(results, config, { rules: [off, enabled], applyCriticalCap: false });
    expect(Number.isFinite(score)).toBe(true);
    expect(score).toBe(96);
  });
});

describe('computeScore — inventory floor', () => {
  const config = defineConfig({});

  it('scores a one-rule pair at 80 for a single warning', () => {
    // Inventory 5 floored to 25: 100 − 500/25.
    const rules = [r('x/only', 'seo', 'component', 'warning')];
    const results = [fail('x/only', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules, applyCriticalCap: false }).score).toBe(80);
  });

  it('scores an eight-info pair at 96 for a single info', () => {
    // Inventory 8 floored to 25: 100 − 100/25.
    const rules = Array.from({ length: 8 }, (_, i) => r(`a/${i}`, 'architecture', 'component', 'info'));
    const results = [fail('a/0', 'src/A.svelte', 'info')];
    expect(computeScore(results, config, { rules }).score).toBe(96);
  });

  it('leaves a pair above the floor unchanged', () => {
    // Inventory 30 > 25, so one warning costs 500/30 and the key scores 83.
    const rules = Array.from({ length: 6 }, (_, i) => r(`s/${i}`, 'seo', 'route', 'warning'));
    const results = [fail('s/0', '/a', 'warning')];
    expect(computeScore(results, config, { rules }).score).toBe(83);
  });

  it('still scores 100 when nothing is penalized', () => {
    const rules = [r('x/only', 'seo', 'component', 'warning')];
    expect(computeScore([pass('x/only', 'src/A.svelte')], config, { rules }).score).toBe(100);
  });

  it('still subtracts sitePenalty in absolute points', () => {
    // A site-wide warning costs 5, not a share of anything — the floor must not reach it.
    const rules = [r('p/site', 'seo', 'project', 'warning'), r('s/one', 'seo', 'route', 'warning')];
    const results = [
      {
        id: 'p/site',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'x'
      },
      pass('s/one', '/a')
    ] as Result[];
    const sr = computeScore(results, config, { rules });
    expect(sr.scoreModel.sitePenalty).toBe(5);
    expect(sr.score).toBe(95);
  });

  it('orders info below warning in every registry pair', () => {
    // Derived from the registry rather than written out, so a new rule cannot silently break the
    // ordering. Each pair's real weight is rebuilt as a same-weight synthetic rule set and scored
    // through computeScore itself — reimplementing the cost formula here would only rubber-stamp
    // the same bug it is meant to catch.
    const inv = buildInventory(config);
    const infoScores: number[] = [];
    const warnScores: number[] = [];
    for (const [pair, weight] of inv) {
      const [category, scope] = pair.split('::') as [Rule['category'], Rule['scope']];

      const infoId = `${pair}/i0`;
      const infoRule = r(infoId, category, scope, 'info');
      const infoRules = [
        infoRule,
        ...Array.from({ length: weight - 1 }, (_, i) => r(`${pair}/i${i + 1}`, category, scope, 'info'))
      ];
      infoScores.push(
        computeScore([fail(infoId, 'k', 'info')], config, { rules: infoRules, applyCriticalCap: false }).score
      );

      // Every rule not designated the failing warning is an info filler, so the set still totals `weight`.
      const warnId = `${pair}/w0`;
      const warnRule = r(warnId, category, scope, 'warning');
      const remainder = weight - 5;
      const warnRules = [
        warnRule,
        ...Array.from({ length: remainder }, (_, i) => r(`${pair}/r${i}`, category, scope, 'info'))
      ];
      warnScores.push(
        computeScore([fail(warnId, 'k', 'warning')], config, { rules: warnRules, applyCriticalCap: false }).score
      );
    }
    // The worst (lowest-scoring) info finding anywhere in the registry must still score no worse
    // than the best (highest-scoring) warning finding anywhere in it.
    expect(Math.min(...infoScores)).toBeGreaterThanOrEqual(Math.max(...warnScores));
  });
});
