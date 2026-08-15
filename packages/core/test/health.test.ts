import { describe, it, expect } from 'vitest';
import { defineConfig, type Category, type Result } from '../src/index.js';
import { computeHealth } from '../src/internal.js';

const CONFIG = defineConfig({});

const seoFail = (route: string): Result => ({
  id: 'seo/title-presence',
  category: 'seo',
  severity: 'critical',
  detection: { presence: 'none', value: 'absent' },
  route,
  message: 'Missing <title>'
});
const pass = (id: string, category: Result['category'], route: string): Result => ({
  id,
  category,
  severity: 'warning',
  detection: { presence: 'own', value: 'static' },
  route,
  message: 'ok'
});

describe('computeHealth', () => {
  it('averages present category scores with equal default weights', () => {
    // SEO: one route, critical missing → low; performance: clean seed → 100.
    const results = [seoFail('/a'), pass('performance', 'performance', '/a')];
    const { health, categories, weights } = computeHealth(results, defineConfig({}));
    expect(categories.seo).toBeDefined();
    expect(categories.performance!.score).toBe(100);
    // equal weights → floor of the mean of the two unrounded category scores
    const mean = Math.floor((categories.seo!.rawScore + 100) / 2);
    expect(health).toBe(mean);
    expect(weights).toEqual({ seo: 1, performance: 1 });
  });

  it('honors Config.weights overrides', () => {
    const results = [seoFail('/a'), pass('performance', 'performance', '/a')];
    const equal = computeHealth(results, defineConfig({})).health;
    const seoHeavy = computeHealth(results, defineConfig({ weights: { seo: 3, performance: 1 } })).health;
    // weighting the low SEO score more heavily pulls Health below the equal-weight mean
    expect(seoHeavy).toBeLessThan(equal);
  });

  it('excludes absent categories and re-normalizes (only SEO present)', () => {
    const results = [pass('seo/title-presence', 'seo', '/a')];
    const { health, categories, weights } = computeHealth(results, defineConfig({}));
    expect(Object.keys(categories)).toEqual(['seo']);
    expect(weights).toEqual({ seo: 1 });
    expect(health).toBe(100);
  });

  it('returns 100 when there are no results', () => {
    expect(computeHealth([], defineConfig({})).health).toBe(100);
  });

  it('throws RangeError for a negative weight', () => {
    const results = [seoFail('/a')];
    expect(() => computeHealth(results, defineConfig({ weights: { seo: -1 } }))).toThrow(RangeError);
  });

  it('throws RangeError for a non-finite weight (NaN)', () => {
    const results = [seoFail('/a')];
    expect(() => computeHealth(results, defineConfig({ weights: { seo: NaN } }))).toThrow(RangeError);
  });

  it('throws RangeError when every present category has weight 0 (would otherwise mask findings)', () => {
    const results = [seoFail('/a'), pass('performance', 'performance', '/a')];
    expect(() => computeHealth(results, defineConfig({ weights: { seo: 0, performance: 0 } }))).toThrow(RangeError);
  });

  it('allows a 0 weight as long as another present category is positive', () => {
    const results = [seoFail('/a'), pass('performance', 'performance', '/a')];
    // seo dropped to weight 0 → Health is exactly the performance score (100).
    const { health, weights } = computeHealth(results, defineConfig({ weights: { seo: 0, performance: 1 } }));
    expect(weights).toEqual({ seo: 0, performance: 1 });
    expect(health).toBe(100);
  });
});

/** `keys` route keys in `category`, the first `findings` of them carrying one `info` finding. */
const cat = (category: Category, keys: number, findings: number): Result[] =>
  Array.from({ length: keys }, (_, i) => ({
    id: `${category}/x`,
    category,
    severity: 'info' as const,
    detection:
      i < findings
        ? { presence: 'none' as const, value: 'absent' as const }
        : { presence: 'own' as const, value: 'static' as const },
    route: `${category}-k${i}`,
    message: 'm',
    recommendation: 'r'
  }));

describe('computeHealth — one rounding, at the boundary', () => {
  /**
   * `keys` keys on a real registry rule id (not the ghost `${category}/x`), the first `findings`
   * penalized at `severity`. Because the id has a real (category, scope) inventory, a failing key's
   * deficit runs through the general `100 * failed / max(inventory, failed)` path instead of the
   * zero-inventory edge case, where a ghost id always wipes a penalized key to a 100% deficit
   * regardless of severity (see score.test.ts "scores 0, not NaN, for a penalized result whose rule is
   * not in the inventory").
   */
  const realKeys = (
    id: string,
    category: Category,
    keys: number,
    findings: number,
    severity: 'info' | 'warning' | 'critical'
  ): Result[] =>
    Array.from({ length: keys }, (_, i) => ({
      id,
      category,
      severity,
      detection:
        i < findings
          ? { presence: 'none' as const, value: 'absent' as const }
          : { presence: 'own' as const, value: 'static' as const },
      route: `${category}-k${i}`,
      message: 'm',
      recommendation: 'r'
    }));

  it('floors the mean of the unrounded category scores, not of the displayed ones', () => {
    // One info-severity (deduction 1) finding costs 100/I per failing key against a real inventory I.
    // Choosing exactly F = I failing keys out of 1000 makes the category's total deficit exactly
    // I * (100/I) = 100, so raw = 100 - 100/1000 = 99.9 — independent of which real (category, scope)
    // inventory I is used:
    //   seo::route (I=110): 110 of 1000 keys fail       -> 99.9
    //   performance::route (I=28): 28 of 1000 keys fail -> 99.9
    //   correctness::component (I=96): 96 of 1000 fail  -> 99.9
    //   security::component (I=35): 35 of 1000 fail     -> 99.9
    // architecture::component (I=8) uses 21*I = 168 failing keys instead: each costs 100*1/8 = 12.5,
    // so 168 * 12.5 / 1000 = 2.1 deficit -> raw = 97.9.
    // Raw category scores [99.9, 99.9, 99.9, 99.9, 97.9] -> mean 99.5 -> floor 99.
    // Averaging the floored scores [99, 99, 99, 99, 97] first gives 98.6 -> floor 98, which is what
    // this test asserts against.
    const results = [
      ...realKeys('seo/title-presence', 'seo', 1000, 110, 'info'),
      ...realKeys('performance/image-loading-hint', 'performance', 1000, 28, 'info'),
      ...realKeys('correctness/unmutated-state', 'correctness', 1000, 96, 'info'),
      ...realKeys('security/raw-html', 'security', 1000, 35, 'info'),
      ...realKeys('architecture/component-size', 'architecture', 1000, 168, 'info')
    ];
    expect(computeHealth(results, CONFIG).health).toBe(99);
  });

  it('lets a site-wide finding reach Health even when every route key is clean', () => {
    // The invariant: Health 100 requires no finding of any kind, route-scoped or not.
    const results: Result[] = [
      ...cat('seo', 10, 0),
      {
        id: 'seo/robots-txt',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        message: 'no robots.txt',
        recommendation: 'r'
      }
    ];
    expect(computeHealth(results, CONFIG).health).toBe(95);
  });

  it('lets a capped category pull Health down', () => {
    const capped = cat('security', 200, 0).map((r, i) =>
      i === 0
        ? { ...r, severity: 'critical' as const, detection: { presence: 'none' as const, value: 'absent' as const } }
        : r
    );
    const { health, categories } = computeHealth([...cat('seo', 200, 0), ...capped], CONFIG);
    expect(categories.security!.score).toBe(79);
    expect(health).toBe(89); // floor((100 + 79) / 2)
  });

  it('shows 100 only when every positively weighted present category deducted nothing', () => {
    expect(computeHealth([...cat('seo', 10, 0), ...cat('security', 10, 0)], CONFIG).health).toBe(100);
    expect(computeHealth([], CONFIG).health).toBe(100);
    // A zero-weight category is present (its rule ran) and can hold a penalized finding — here severe
    // enough to cap its own score at 79 — without moving Health at all: the invariant is bounded to
    // positively weighted categories, not merely present ones. One critical (deduction 15) amid 199
    // clean keys on the real `security/raw-html` id (security::component inventory 35) costs
    // 100*15/35 = 42.857... against its one key, so raw = 100 - 42.857.../200 = 99.7857...; any
    // critical present caps a raw score above 79 down to exactly 79 regardless of how small the
    // underlying deficit is.
    const penalizedSecurity: Result[] = realKeys('security/raw-html', 'security', 200, 1, 'critical');
    const zeroWeighted = computeHealth(
      [...cat('seo', 10, 0), ...penalizedSecurity],
      defineConfig({ weights: { seo: 1, security: 0 } })
    );
    expect(zeroWeighted.categories.security!.score).toBe(79);
    expect(zeroWeighted.health).toBe(100);
  });

  it('treats a weight small enough to underflow an epsilon as still not clean (regression)', () => {
    // seo carries a single `info` finding on its only key; `${category}/x` has no inventory (see the
    // test above), so the key takes a full 100% deficit and seo's rawScore is 0, not merely reduced.
    // Weighted at 1e-12 alongside a clean weight-1 category, the true quotient is 99.9999999999 — below
    // 100, but only by ~1e-10 (the full 100-point deficit times the negligible weight share). The old
    // `Math.floor(weighted / total + 1e-9)` guard rounded that up to 100,
    // silently letting a real finding hide behind a tiny weight and pass `--min-health 100`. Working in
    // deficit space has no such blind spot: the deficit here is strictly positive (not the exact-zero
    // case), so it is floored down, not tolerance-forgiven. Confirmed this fails (returns 100) against
    // the `+ 1e-9` implementation before the fix.
    const results = [...cat('seo', 1, 1), ...cat('performance', 10, 0)];
    const { health } = computeHealth(results, defineConfig({ weights: { seo: 1e-12, performance: 1 } }));
    expect(health).toBe(99);
  });

  it('shows 100 for a clean project under fractional weights, with no floating-point error to guard against', () => {
    // weights [0.1, 1] over two clean (rawScore 100) categories. Averaging the SCORE, `weighted / total`
    // is 110 / 1.1 === 99.99999999999999 in IEEE doubles — not exactly 100, which is why an earlier
    // version needed an epsilon guard here. Averaging the DEFICIT instead has no such error to guard
    // against: each term is `(100 - 100) * w === 0` exactly, for any weight, so the sum is exactly 0 and
    // `averageDeficit === 0` takes the direct path to 100 rather than surviving a tolerance check.
    const results = [...cat('seo', 4, 0), ...cat('performance', 4, 0)];
    const { health } = computeHealth(results, defineConfig({ weights: { seo: 0.1, performance: 1 } }));
    expect(health).toBe(100);
  });
});
