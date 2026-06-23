import { describe, it, expect } from 'vitest';
import { computeHealth, defineConfig, type Result } from '../src/index.js';

const seoFail = (route: string): Result => ({
  id: 'SEO001',
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
    // equal weights → mean of the two category scores
    const mean = Math.round((categories.seo!.score + 100) / 2);
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
    const results = [pass('SEO001', 'seo', '/a')];
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
