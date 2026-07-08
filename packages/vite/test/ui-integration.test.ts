import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
import type { Result } from '@svelte-vitals/core';
import { createStore } from '../src/ui/store.js';
import { createAnalysisRunner } from '../src/ui/analysis.js';

// Whole-project analysis → store integration, against a real SvelteKit fixture
// (two routes: '/' with no <svelte:head> at all, '/about' with title+description).
// This runs the real `svelte-vitals` analyzeProject through the runner's dynamic
// import — no page visit involved (design doc 2026-07-08, decision 1).
const FIXTURE = join(__dirname, 'fixtures/basic-project');

async function analyzedStore() {
  const store = createStore();
  const onError = vi.fn();
  const runner = createAnalysisRunner({
    root: FIXTURE,
    onResults: (results) => store.setStatic(results),
    onError
  });
  runner.start();
  await vi.waitFor(() => expect(store.snapshot().length).toBeGreaterThan(0), { timeout: 15000 });
  runner.stop();
  expect(onError).not.toHaveBeenCalled();
  return store;
}

const live = (id: string, route: string): Result =>
  ({
    id,
    message: `${id} (live)`,
    category: 'seo',
    detection: { presence: 'own', value: 'static' },
    route,
    severity: 'critical'
  }) as Result;

describe('dev dashboard whole-project integration (real analyzeProject)', () => {
  it('populates the snapshot with all routes and multiple categories without any page visit', async () => {
    const store = await analyzedStore();
    const snapshot = store.snapshot();

    // Both fixture routes are present — including ones never "visited".
    const routes = new Set(snapshot.map((r) => r.route));
    expect(routes.has('/')).toBe(true);
    expect(routes.has('/about')).toBe(true);

    // Beyond SEO-only: another category (architecture) is in the same snapshot.
    const categories = new Set(snapshot.map((r) => r.category));
    expect(categories.has('seo')).toBe(true);
    expect(categories.size).toBeGreaterThan(1);

    // Site-wide findings (no route: robots/sitemap/html-lang) survive composition.
    expect(snapshot.some((r) => r.route === undefined)).toBe(true);

    // '/' has no <svelte:head> in the fixture → missing-title finding from static analysis.
    expect(snapshot.some((r) => r.id === 'SEO001' && r.route === '/')).toBe(true);

    // Every route in the badge map is static — nothing was measured yet.
    const badges = store.badges();
    expect(badges['/']).toBe('static');
    expect(badges['/about']).toBe('static');
    expect(Object.values(badges).every((b) => b === 'static')).toBe(true);
  });

  it('a live ingest replaces only the matching rule ids on that route and flips its badge to measured', async () => {
    const store = await analyzedStore();
    const staticSnapshot = store.snapshot();
    const staticHome = staticSnapshot.filter((r) => r.route === '/');
    const staticAbout = staticSnapshot.filter((r) => r.route === '/about');
    expect(staticHome.length).toBeGreaterThan(1); // more ids than the live payload below

    // Visit '/': the rendered page evaluated only SEO001 (payload rule-id set = {SEO001}).
    store.set('/', [live('SEO001', '/')]);
    const merged = store.snapshot();

    // The live result replaced the static SEO001 on '/'...
    const home001 = merged.filter((r) => r.id === 'SEO001' && r.route === '/');
    expect(home001).toHaveLength(1);
    expect(home001[0]!.message).toBe('SEO001 (live)');

    // ...while static findings on '/' whose id was NOT in the live payload are kept.
    const homeIds = merged.filter((r) => r.route === '/').map((r) => r.id);
    for (const kept of staticHome.filter((r) => r.id !== 'SEO001')) {
      expect(homeIds).toContain(kept.id);
    }

    // The unvisited route '/about' is byte-for-byte untouched.
    expect(merged.filter((r) => r.route === '/about')).toEqual(staticAbout);

    // Site-wide (routeless) findings are untouched by a route-scoped live payload.
    expect(merged.filter((r) => r.route === undefined)).toEqual(staticSnapshot.filter((r) => r.route === undefined));

    // Provenance: '/' is now measured, '/about' stays static.
    const badges = store.badges();
    expect(badges['/']).toBe('measured');
    expect(badges['/about']).toBe('static');
  });
});
