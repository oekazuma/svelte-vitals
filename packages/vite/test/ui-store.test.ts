import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../src/ui/store.js';
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
});
