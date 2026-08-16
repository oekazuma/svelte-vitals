// Scores are floored, not rounded (2026-07-31): a displayed 100 means the deduction was exactly zero.
import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { computeScore, scoresByCategory, withFailedRulesOff } from '../src/internal.js';
import type { Rule } from '../src/rule.js';
import { buildInventory, DEDUCTION } from '../src/scoring/inventory.js';
import { INVENTORY_FLOOR } from '../src/scoring/score.js';

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
      // seo::route registry inventory (100 as of the P2 severity-alignment change: 110 minus 10 for
      // description-presence critical→warning, plus 4 for og-url info→warning, minus 4 for
      // og-description warning→info) -> key score 100 - 2600/100 = 74. The critical carrier is
      // title-presence, not description-presence — description-presence can no longer produce a
      // 'critical' result, so using it here would assert an unreachable scenario.
      fail('seo/title-presence', '/blog', 'critical'),
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
    expect(scoreModel.routeAverage).toBe(94); // (100*4 + 74)/5 = 94.8 -> floor 94
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
    // /x: critical(15) + 5 warnings(5 each) = 40 failed, against inventory 100 (P2 severity-alignment
    // change, see the test above) -> key score 100 - 4000/100 = 60 - well below the 79 cap. The
    // critical carrier is title-presence — description-presence can no longer produce 'critical'.
    const results: Result[] = [
      fail('seo/title-presence', '/x', 'critical'),
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
      // title-presence, not description-presence — the latter can no longer produce 'critical'
      // after the P2 severity-alignment change.
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        message: 'missing'
      }
    ];
    expect(computeScore(results, defineConfig({})).score).toBe(79); // capped (default)
    // uncapped: failed 15 of inventory 100 -> 100 - 1500/100 = 85
    expect(computeScore(results, defineConfig({}), { applyCriticalCap: false }).score).toBe(85);
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
    // one deduction per (route, rule), taking the max (critical = 15) -> failed 15 of inventory 100
    // (P2 severity-alignment change) -> 100 - 1500/100 = 85, uncapped view. The fabricated severities
    // here (not description-presence's real one, now 'warning') exercise the dedup-by-max mechanism,
    // not any one rule's actual severity ceiling.
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

describe('scoresByCategory — scoring options', () => {
  const config = defineConfig({});
  // One failing `seo` critical on one route: the ratio gives 100 − 1500/100 = 85 (seo::route inventory
  // is 100 as of the P2 severity-alignment change, was 110), the cap gives 79.
  const results = [fail('seo/title-presence', '/a', 'critical')];

  it('caps a category at 79 when called without options', () => {
    // computeHealth calls it this way and depends on a capped category pulling Health down.
    expect(scoresByCategory(results, config).seo!.score).toBe(79);
    expect(scoresByCategory(results, config).seo!.scoreModel.criticalCap).toBe(79);
  });

  it('leaves the category uncapped when the cap is switched off', () => {
    const sr = scoresByCategory(results, config, { applyCriticalCap: false }).seo!;
    expect(sr.score).toBe(85);
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
    // 276 keys fail (id in the real seo::route inventory, 100 as of the P2 severity-alignment
    // change, was 110): 100 - (276*100/100)/585 = 99.528205128...
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
    // One route, one pair (seo::route), inventory padded to exactly 200 with filler info rules
    // that never appear in results — they exist only to size the denominator. A critical, five
    // warnings and one info fail: failed = 15 + 5*5 + 1 = 41 of 200.
    // Raw route average = 100 - 4100/200 = 79.5 (exact: 41/2 is a power-of-two fraction).
    //   Deciding on the raw value: 79.5 > 79 -> cap binds -> rawScore 79, criticalCap 79.
    //   Deciding on the floored value: floor(79.5) = 79 -> 79 > 79 is false -> no cap -> rawScore
    //   would stay 79.5 and criticalCap null. Displayed `score` is 79 either way (floor(79.5) is
    //   also 79), which is why this test must assert on rawScore/criticalCap, not on score.
    const rules = [
      r('s/c1', 'seo', 'route', 'critical'),
      ...Array.from({ length: 5 }, (_, i) => r(`s/w${i}`, 'seo', 'route', 'warning')),
      r('s/i0', 'seo', 'route', 'info'),
      ...Array.from({ length: 159 }, (_, i) => r(`s/fill${i}`, 'seo', 'route', 'info'))
    ]; // inventory: 15 + 5*5 + 1 + 159 = 200
    const results: Result[] = [
      fail('s/c1', '/a', 'critical'),
      ...Array.from({ length: 5 }, (_, i) => fail(`s/w${i}`, '/a', 'warning')),
      fail('s/i0', '/a', 'info')
    ];

    const result = computeScore(results, defineConfig({}), { rules });
    expect(result.score).toBe(79);
    expect(result.rawScore).toBe(79);
    expect(result.scoreModel.criticalCap).toBe(79);
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
    // Inventory 28 (28 info rules) is already ≥ 25, so this anchors the deficit-space mean and the
    // evaluation order together, not the floor: two keys failing 10 and 18 of the infos (deficit
    // 1000/28 and 1800/28) average in deficit space to exactly 50. Both a mean of key scores and the
    // `100 * (1 - f/i)` evaluation order compute 49.99999999999999 for the same true 50 (verified
    // against the formula, not the runner).
    const rules = Array.from({ length: 28 }, (_, i) => r(`m/i${i}`, 'performance', 'component', 'info'));
    const results = [
      ...Array.from({ length: 10 }, (_, i) => fail(`m/i${i}`, 'src/A.svelte', 'info')),
      ...Array.from({ length: 18 }, (_, i) => fail(`m/i${i + 10}`, 'src/B.svelte', 'info'))
    ];
    expect(computeScore(results, config, { rules }).score).toBe(50);
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

  it('lets failed weight outrun the floor when two ghost rules fail on the same key', () => {
    // Two rule ids outside the inventory, both critical, on one key: failed = 15 + 15 = 30, above
    // both the observed inventory (0, no pair) and the floor (25) — the case `max(inventoryWeight,
    // failed, INVENTORY_FLOOR)` needs `failed` for, not just the floor. Diluted across 99 clean keys
    // so the excess shows up in the mean instead of vanishing into the final clamp: with `failed` in
    // the max, this key's deficit is 100, giving 100 - 100/100 = 99; dropping `failed` from the max
    // would floor that key's denominator to 25 instead of 30, giving deficit 120 and 100 - 120/100 = 98.
    const cleanKeys = Array.from({ length: 99 }, (_, i) => `src/${i}.svelte`);
    const results: Result[] = [
      fail('ghost/one', 'src/bad.svelte', 'critical'),
      fail('ghost/two', 'src/bad.svelte', 'critical'),
      ...cleanKeys.map((k) => pass('p/i1', k))
    ];
    expect(computeScore(results, config, { rules: PERF, applyCriticalCap: false }).score).toBe(99);
  });

  it('narrowing the rule set to one category leaves that category unchanged', () => {
    // PERF's own inventory (9) floors to 25 regardless of what else is in `rules`, so a mutant that
    // pools every pair into one denominator would still pass here. Use a performance::component
    // inventory of 30 instead — already above the floor, so pooling in an unrelated seo::route
    // rule's weight (5) would move the score (83 -> 85) if pools were not partitioned by pair.
    const perf30 = [
      r('p/w1', 'performance', 'component', 'warning'),
      ...Array.from({ length: 25 }, (_, i) => r(`p/fill${i}`, 'performance', 'component', 'info'))
    ]; // 5 + 25 = 30
    const mixed = [...perf30, r('seo/x', 'seo', 'route', 'warning')];
    const results = [fail('p/w1', 'src/A.svelte', 'warning')];
    expect(computeScore(results, config, { rules: mixed }).score).toBe(
      computeScore(results, config, { rules: perf30 }).score
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
    // architecture::component is 9 info rules (inventory 9) by default. Raising two of them to
    // 'critical' makes it 7 info + 2 critical = 7 + 30 = 37, above the floor. Verified against the
    // real registry: a key failing one of the raised rules (now 'critical', deduction 15) scores
    // 100 - 1500/37 = 59.46, floored 59. A `computeScore` that ignored `config.rules` when building
    // the inventory would see the unconfigured 9, floor it to 25, and score 100 - 1500/25 = 40 instead.
    const config = defineConfig({
      rules: { 'architecture/component-size': 'critical', 'architecture/prop-count': 'critical' }
    });
    const results = [fail('architecture/component-size', 'src/A.svelte', 'critical')];
    expect(computeScore(results, config).score).toBe(59);
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

describe('computeScore — a rule that threw at runtime (withFailedRulesOff)', () => {
  // Six warning rules share a pair (inventory 30, above the floor). Rule a/5 "crashed" — it
  // produced no results, exactly like one that ran clean, so its own absence from `results`
  // can't distinguish the two cases; only the config it's scored under can.
  const rules = Array.from({ length: 6 }, (_, i) => r(`a/${i}`, 'architecture', 'component', 'warning'));
  const results = [fail('a/0', 'src/A.svelte', 'warning')];

  it('WITH the crashed rule still counted in the inventory (pre-fix), it scores as if a/5 passed', () => {
    const config = defineConfig({});
    const { score } = computeScore(results, config, { rules, applyCriticalCap: false });
    expect(score).toBe(83); // 100 - 500/30
  });

  it('WITHOUT it — withFailedRulesOff drops its weight — the same failure scores lower, not inflated', () => {
    const config = withFailedRulesOff(defineConfig({}), ['a/5']);
    const { score } = computeScore(results, config, { rules, applyCriticalCap: false });
    expect(score).toBe(80); // 100 - 500/25 (inventory 25, floor)
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

  it('orders severities within a pair, but not across pairs', () => {
    // Extends the previous test's construction to `critical` and to comparing across pairs, not
    // only within one — pinning the actual guarantee (per pair) against the stronger one it is
    // easy to misstate (per category).
    const inv = buildInventory(config);
    const scoreOf = (pair: string, weight: number, sev: 'critical' | 'warning' | 'info') => {
      const [category, scope] = pair.split('::') as [Rule['category'], Rule['scope']];
      const markerId = `${pair}/${sev}`;
      const filler = Math.max(weight - DEDUCTION[sev], 0);
      const rules = [
        r(markerId, category, scope, sev),
        ...Array.from({ length: filler }, (_, i) => r(`${pair}/f${i}`, category, scope, 'info'))
      ];
      return computeScore([fail(markerId, 'k', sev)], config, { rules, applyCriticalCap: false }).score;
    };

    const warningScores: number[] = [];
    const criticalScores: number[] = [];
    for (const [pair, weight] of inv) {
      const info = scoreOf(pair, weight, 'info');
      const warning = scoreOf(pair, weight, 'warning');
      const critical = scoreOf(pair, weight, 'critical');
      expect(info).toBeGreaterThan(warning);
      expect(warning).toBeGreaterThan(critical);
      warningScores.push(warning);
      criticalScores.push(critical);
    }
    // A warning in the thinnest (floored) pair still scores lower — costs more — than a critical
    // in the thickest one: the order above holds inside a pair, and is not guaranteed across pairs.
    expect(Math.min(...warningScores)).toBeLessThan(Math.max(...criticalScores));
  });

  it('keeps a cheap info cheaper than the cheapest warning as the registry grows', () => {
    // An info in a floored pair costs 100/K; the cheapest warning costs 500/i_max. The ordering the
    // floor exists for holds only while 5*K > i_max, and the registry grows toward that line — so the
    // remedy is in the failure message: the PR that crosses it raises the floor in the same change,
    // and the score movement lands with the rules that caused it.
    // `::project` pairs are excluded: project findings deduct absolute points through `sitePenalty`
    // and never divide by an inventory, so a wide project pair would demand a floor rise that moves
    // every clamped score for an ordering it does not participate in.
    const inv = buildInventory(config);
    const widest = Math.max(...[...inv].filter(([pair]) => !pair.endsWith('::project')).map(([, w]) => w));
    expect(
      widest,
      `the widest inventory (${widest}) has reached 5x INVENTORY_FLOOR (${INVENTORY_FLOOR}), so an info in a floored pair now costs at least as much as a warning in the widest one. Raise INVENTORY_FLOOR to ${Math.floor(widest / 5) + 1} in this PR.`
    ).toBeLessThan(5 * INVENTORY_FLOOR);
  });
});

describe('computeScore — reach', () => {
  const config = defineConfig({});
  const rules = Array.from({ length: 8 }, (_, i) => r(`a/${i}`, 'architecture', 'component', 'info'));

  it('counts keys touched and keys penalized', () => {
    const results = [fail('a/0', 'src/A.svelte', 'info'), pass('a/0', 'src/B.svelte'), pass('a/0', 'src/C.svelte')];
    const sr = computeScore(results, config, { rules });
    expect(sr.keys).toBe(3);
    expect(sr.affectedKeys).toBe(1);
  });

  it('reports the same score and different reach for one finding and for many', () => {
    // The reason reach exists: 41 affected keys of 351 (a real project's own numbers) dilute to
    // the same floored score as a single affected key, and must still be distinguishable.
    const keys = Array.from({ length: 351 }, (_, i) => `src/${i}.svelte`);
    const one = keys.map((k, i) => (i === 0 ? fail('a/0', k, 'info') : pass('a/0', k)));
    const many = keys.map((k, i) => (i < 41 ? fail('a/0', k, 'info') : pass('a/0', k)));
    const a = computeScore(one, config, { rules });
    const b = computeScore(many, config, { rules });
    expect(a.score).toBe(b.score);
    expect(a.affectedKeys).toBe(1);
    expect(b.affectedKeys).toBe(41);
  });

  it('counts a key once however many rules penalize it', () => {
    const results = [fail('a/0', 'src/A.svelte', 'info'), fail('a/1', 'src/A.svelte', 'info')];
    expect(computeScore(results, config, { rules }).affectedKeys).toBe(1);
  });
});
