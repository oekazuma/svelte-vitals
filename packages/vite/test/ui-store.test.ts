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
    s.set('/a', [r('SEO001', '/a')]);
    s.set('/b', [r('SEO002', '/b')]);
    expect(
      s
        .snapshot()
        .map((x) => x.id)
        .sort()
    ).toEqual(['SEO001', 'SEO002']);
  });

  it('replaces (not appends) a route on re-set', () => {
    const s = createStore();
    s.set('/a', [r('SEO001', '/a')]);
    s.set('/a', [r('SEO002', '/a')]);
    expect(s.snapshot().map((x) => x.id)).toEqual(['SEO002']);
  });

  it('stamps the route onto results missing one', () => {
    const s = createStore();
    s.set('/a', [r('SEO001')]); // no route on the result
    expect(s.snapshot()[0]!.route).toBe('/a');
  });

  it('notifies subscribers on set and supports unsubscribe', () => {
    const s = createStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.set('/a', [r('SEO001', '/a')]);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.set('/b', [r('SEO002', '/b')]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers on setStatic', () => {
    const s = createStore();
    const fn = vi.fn();
    s.subscribe(fn);
    s.setStatic([r('SEO001', '/a')]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('snapshot() includes the static layer alone when no live layer exists', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a'), r('SEO002', '/b')]);
    expect(
      s
        .snapshot()
        .map((x) => x.id)
        .sort()
    ).toEqual(['SEO001', 'SEO002']);
  });

  it('badges() marks every static-only route as static', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a'), r('SEO002', '/b')]);
    expect(s.badges()).toEqual({ '/a': 'static', '/b': 'static' });
  });

  it('live overrides the static result for a matching rule id on a visited route', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a')]);
    s.set('/a', [{ ...r('SEO001', '/a'), message: 'live version' }]);
    const found = s.snapshot().filter((x) => x.id === 'SEO001' && x.route === '/a');
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toBe('live version');
  });

  it('keeps a static rule id on a visited route when live did not evaluate that id', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a'), r('SEO002', '/a')]);
    s.set('/a', [r('SEO002', '/a')]); // live only re-evaluated SEO002
    const ids = s
      .snapshot()
      .filter((x) => x.route === '/a')
      .map((x) => x.id)
      .sort();
    expect(ids).toEqual(['SEO001', 'SEO002']);
  });

  it('preserves routeless (component/site-scoped) static findings untouched by live', () => {
    const s = createStore();
    s.setStatic([r('CORRECT001'), r('SEO001', '/a')]);
    s.set('/a', [r('SEO001', '/a')]);
    expect(s.snapshot().some((x) => x.id === 'CORRECT001' && x.route === undefined)).toBe(true);
  });

  it('keeps an unvisited route on the static layer', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a'), r('SEO002', '/never-visited')]);
    s.set('/a', [r('SEO001', '/a')]);
    expect(s.snapshot().some((x) => x.id === 'SEO002' && x.route === '/never-visited')).toBe(true);
  });

  it('keeps a live-only route (not present in the static layer) as-is', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a')]);
    s.set('/brand-new', [r('SEO003', '/brand-new')]);
    expect(s.snapshot().some((x) => x.id === 'SEO003' && x.route === '/brand-new')).toBe(true);
  });

  it('badges() reports measured for a visited route and static for the rest', () => {
    const s = createStore();
    s.setStatic([r('SEO001', '/a'), r('SEO002', '/b')]);
    s.set('/a', [r('SEO001', '/a')]);
    expect(s.badges()).toEqual({ '/a': 'measured', '/b': 'static' });
  });

  it('badges() reports measured for every route when the static layer is empty', () => {
    const s = createStore();
    s.set('/a', [r('SEO001', '/a')]);
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

  it('sequence() strictly increases across set/setStatic/setAnalyzing', () => {
    const s = createStore();
    const seq0 = s.sequence();
    s.set('/a', [r('SEO001', '/a')]);
    const seq1 = s.sequence();
    expect(seq1).toBeGreaterThan(seq0);
    s.setStatic([r('SEO002', '/b')]);
    const seq2 = s.sequence();
    expect(seq2).toBeGreaterThan(seq1);
    s.setAnalyzing(true);
    const seq3 = s.sequence();
    expect(seq3).toBeGreaterThan(seq2);
  });
});

describe('composeSnapshot / composeBadges (pure)', () => {
  it('composeSnapshot returns only the static layer when the live map is empty', () => {
    const out = composeSnapshot([r('SEO001', '/a')], new Map());
    expect(out.map((x) => x.id)).toEqual(['SEO001']);
  });

  it('composeBadges returns an empty map when both layers are empty', () => {
    expect(composeBadges([], new Map())).toEqual({});
  });
});
