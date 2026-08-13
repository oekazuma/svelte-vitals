import { describe, it, expect, vi } from 'vitest';
import { createStore, composeSnapshot, composeBadges } from '../src/ui/store.js';
import type { Result } from '@svelte-vitals/core';

const r = (id: string, route?: string): Result =>
  ({
    id,
    message: id,
    category: 'seo',
    detection: { presence: 'none', value: 'absent' },
    route,
    severity: 'critical'
  }) as Result;

describe('createStore', () => {
  it('flattens results across routes in snapshot()', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')]);
    s.set('/b', [r('seo/description-presence', '/b')]);
    expect(
      s
        .snapshot()
        .map((x) => x.id)
        .sort()
    ).toEqual(['seo/description-presence', 'seo/title-presence']);
  });

  it('replaces (not appends) a route on re-set', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')]);
    s.set('/a', [r('seo/description-presence', '/a')]);
    expect(s.snapshot().map((x) => x.id)).toEqual(['seo/description-presence']);
  });

  it('stamps the route onto results missing one', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence')]); // no route on the result
    expect(s.snapshot()[0]!.route).toBe('/a');
  });

  it('notifies subscribers on set and supports unsubscribe', () => {
    const s = createStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.set('/b', [r('seo/description-presence', '/b')]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on setStatic', () => {
    const s = createStore();
    const fn = vi.fn();
    s.subscribe(fn);
    s.setStatic([r('seo/title-presence', '/a')]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('snapshot() includes the static layer alone when no live layer exists', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a'), r('seo/description-presence', '/b')]);
    expect(
      s
        .snapshot()
        .map((x) => x.id)
        .sort()
    ).toEqual(['seo/description-presence', 'seo/title-presence']);
  });

  it('badges() marks every static-only route as static', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a'), r('seo/description-presence', '/b')]);
    expect(s.badges()).toEqual({ '/a': 'static', '/b': 'static' });
  });

  it('live overrides the static result for a matching rule id on a visited route', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a')]);
    s.set('/a', [{ ...r('seo/title-presence', '/a'), message: 'live version' }]);
    const found = s.snapshot().filter((x) => x.id === 'seo/title-presence' && x.route === '/a');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toBe('live version');
  });

  it('keeps a static rule id on a visited route when live did not evaluate that id', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a'), r('seo/description-presence', '/a')]);
    s.set('/a', [r('seo/description-presence', '/a')]); // live only re-evaluated seo/description-presence
    const ids = s
      .snapshot()
      .filter((x) => x.route === '/a')
      .map((x) => x.id)
      .sort();
    expect(ids).toEqual(['seo/description-presence', 'seo/title-presence']);
  });

  it('preserves routeless (component/site-scoped) static findings untouched by live', () => {
    const s = createStore();
    s.setStatic([r('correctness/each-key'), r('seo/title-presence', '/a')]);
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.snapshot().some((x) => x.id === 'correctness/each-key' && x.route === undefined)).toBe(true);
  });

  it('keeps an unvisited route on the static layer', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a'), r('seo/description-presence', '/never-visited')]);
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.snapshot().some((x) => x.id === 'seo/description-presence' && x.route === '/never-visited')).toBe(true);
  });

  it('keeps a live-only route (not present in the static layer) as-is', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a')]);
    s.set('/brand-new', [r('seo/canonical-url', '/brand-new')]);
    expect(s.snapshot().some((x) => x.id === 'seo/canonical-url' && x.route === '/brand-new')).toBe(true);
  });

  it('badges() reports measured for a visited route and static for the rest', () => {
    const s = createStore();
    s.setStatic([r('seo/title-presence', '/a'), r('seo/description-presence', '/b')]);
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.badges()).toEqual({ '/a': 'measured', '/b': 'static' });
  });

  it('badges() reports measured for every route when the static layer is empty', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.badges()).toEqual({ '/a': 'measured' });
  });

  it('setAnalyzing/isAnalyzing round-trips and notifies subscribers', () => {
    const s = createStore();
    const fn = vi.fn();
    s.subscribe(fn);
    expect(s.isAnalyzing()).toBe(false);
    s.setAnalyzing(true);
    expect(s.isAnalyzing()).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
    s.setAnalyzing(false);
    expect(s.isAnalyzing()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('failedRuleIds() is empty when nothing has failed', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.failedRuleIds()).toEqual([]);
  });

  it('failedRuleIds() unions failed ids across routes, sorted', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')], ['seo/json-ld']);
    s.set('/b', [r('seo/description-presence', '/b')], ['seo/canonical-url']);
    expect(s.failedRuleIds()).toEqual(['seo/canonical-url', 'seo/json-ld']);
  });

  it('re-set on a route replaces its failed-rule ids, not appends', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')], ['seo/json-ld']);
    s.set('/a', [r('seo/title-presence', '/a')], ['seo/canonical-url']);
    expect(s.failedRuleIds()).toEqual(['seo/canonical-url']);
  });

  it('re-set with no failedRuleIds clears a route that previously failed (recovery)', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')], ['seo/json-ld']);
    expect(s.failedRuleIds()).toEqual(['seo/json-ld']);
    s.set('/a', [r('seo/title-presence', '/a')]);
    expect(s.failedRuleIds()).toEqual([]);
  });

  it('re-set with an empty failedRuleIds array clears a route that previously failed', () => {
    const s = createStore();
    s.set('/a', [r('seo/title-presence', '/a')], ['seo/json-ld']);
    s.set('/a', [r('seo/title-presence', '/a')], []);
    expect(s.failedRuleIds()).toEqual([]);
  });

  it('sequence() strictly increases across set/setStatic/setAnalyzing', () => {
    const s = createStore();
    const seq0 = s.sequence();
    s.set('/a', [r('seo/title-presence', '/a')]);
    const seq1 = s.sequence();
    expect(seq1).toBeGreaterThan(seq0);
    s.setStatic([r('seo/description-presence', '/b')]);
    const seq2 = s.sequence();
    expect(seq2).toBeGreaterThan(seq1);
    s.setAnalyzing(true);
    const seq3 = s.sequence();
    expect(seq3).toBeGreaterThan(seq2);
  });
});

describe('composeSnapshot / composeBadges (pure)', () => {
  it('composeSnapshot returns only the static layer when the live map is empty', () => {
    const out = composeSnapshot([r('seo/title-presence', '/a')], new Map());
    expect(out.map((x) => x.id)).toEqual(['seo/title-presence']);
  });

  it('composeBadges returns an empty map when both layers are empty', () => {
    expect(composeBadges([], new Map())).toEqual({});
  });
});
