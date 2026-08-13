import type { Result } from '@svelte-vitals/core';

export type RouteBadge = 'measured' | 'static';

/**
 * In-memory findings store for the dev UI. Owned by the ui plugin, shared between the
 * analysis runner (writes the static, whole-project layer) and the ingest middleware
 * (writes the live, per-route layer from rendered pages). `snapshot()`/`badges()` expose
 * the merged view per the design doc (2026-07-08-dev-dashboard-whole-project-design.md §2).
 */
export interface FindingsStore {
  /**
   * Replace a route's live findings (route stamped onto results missing one) and notify
   * subscribers. `failedRuleIds` replaces that route's live-layer failed-rule set — an
   * omitted or empty array clears it, so a route re-analyzed with no failures recovers.
   */
  set(route: string, results: Result[], failedRuleIds?: string[]): void;
  /** Replace the whole static (whole-project) layer and notify subscribers. */
  setStatic(results: Result[]): void;
  /** Mark whether a whole-project analysis run is currently in flight; participates in subscribe/notify like a findings change. */
  setAnalyzing(analyzing: boolean): void;
  isAnalyzing(): boolean;
  /** Composed findings across both layers — feed straight into buildJsonReport. */
  snapshot(): Result[];
  /** Per-route provenance for the dashboard's badges: 'measured' (live) or 'static'. */
  badges(): Record<string, RouteBadge>;
  /** Union of failed rule ids across every live (ingested) route, for `withFailedRulesOff`. */
  failedRuleIds(): string[];
  /** Monotonically increasing counter, bumped once per notify() — lets consumers discard stale fetches. */
  sequence(): number;
  /** Subscribe to change notifications; returns an unsubscribe function. */
  subscribe(fn: () => void): () => void;
}

/**
 * Merge rule (design doc §2): for a route with a live result set, static results whose
 * rule id appears in the live payload are replaced by the live ones — the handle reports
 * passing as well as failing results, so the rule ids present in the payload ARE the
 * evaluated set. Everything else — component/site-scoped findings (no route) and
 * unvisited routes — keeps the static result untouched. Pure function so it is
 * unit-testable without the store's mutable state.
 */
export function composeSnapshot(staticResults: Result[], liveByRoute: Map<string, Result[]>): Result[] {
  const staticByRoute = new Map<string, Result[]>();
  const routeless: Result[] = [];
  for (const r of staticResults) {
    if (r.route) {
      const bucket = staticByRoute.get(r.route);
      if (bucket) bucket.push(r);
      else staticByRoute.set(r.route, [r]);
    } else {
      routeless.push(r);
    }
  }

  const out: Result[] = [...routeless];
  for (const [route, live] of liveByRoute) {
    const liveIds = new Set(live.map((r) => r.id));
    const staticForRoute = staticByRoute.get(route) ?? [];
    out.push(...staticForRoute.filter((r) => !liveIds.has(r.id)), ...live);
    staticByRoute.delete(route); // consumed — remaining entries are unvisited routes
  }
  for (const remaining of staticByRoute.values()) out.push(...remaining);

  return out;
}

/** Per-route provenance for the merged view: 'measured' where a live layer exists, else 'static'. */
export function composeBadges(staticResults: Result[], liveByRoute: Map<string, Result[]>): Record<string, RouteBadge> {
  const badges: Record<string, RouteBadge> = {};
  for (const r of staticResults) {
    if (r.route) badges[r.route] = 'static';
  }
  for (const route of liveByRoute.keys()) badges[route] = 'measured';
  return badges;
}

export function createStore(): FindingsStore {
  let staticResults: Result[] = [];
  const liveByRoute = new Map<string, Result[]>();
  const liveFailedByRoute = new Map<string, string[]>();
  const subs = new Set<() => void>();
  let analyzing = false;
  let seq = 0;

  function notify(): void {
    seq += 1;
    for (const fn of subs) fn();
  }

  return {
    set(route, results, failedRuleIds) {
      liveByRoute.set(
        route,
        results.map((r) => (r.route ? r : { ...r, route }))
      );
      if (failedRuleIds && failedRuleIds.length > 0) liveFailedByRoute.set(route, failedRuleIds);
      else liveFailedByRoute.delete(route);
      notify();
    },
    setStatic(results) {
      staticResults = results;
      notify();
    },
    setAnalyzing(next) {
      analyzing = next;
      notify();
    },
    isAnalyzing() {
      return analyzing;
    },
    snapshot() {
      return composeSnapshot(staticResults, liveByRoute);
    },
    badges() {
      return composeBadges(staticResults, liveByRoute);
    },
    failedRuleIds() {
      return [...new Set([...liveFailedByRoute.values()].flat())].sort();
    },
    sequence() {
      return seq;
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    }
  };
}
