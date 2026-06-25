import type { Result } from '@svelte-vitals/core';

/** In-memory findings store for the dev UI. Owned by the dev-server middleware. */
export interface FindingsStore {
  /** Replace a route's findings (route stamped onto results missing one) and notify subscribers. */
  set(route: string, results: Result[]): void;
  /** All findings across routes, flattened — feed straight into buildJsonReport. */
  snapshot(): Result[];
  /** Subscribe to change notifications; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

export function createStore(): FindingsStore {
  const byRoute = new Map<string, Result[]>();
  const subs = new Set<() => void>();
  return {
    set(route, results) {
      byRoute.set(
        route,
        results.map((r) => (r.route ? r : { ...r, route }))
      );
      for (const fn of subs) fn();
    },
    snapshot() {
      return [...byRoute.values()].flat();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
