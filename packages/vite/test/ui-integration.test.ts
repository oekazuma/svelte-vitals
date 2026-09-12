import { describe, it, expect, vi } from 'vitest';
import { join } from 'node:path';
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
    expect(snapshot.some((r) => r.id === 'seo/title-presence' && r.route === '/')).toBe(true);

    // Every route in the badge map is static — nothing was measured yet.
    const badges = store.badges();
    expect(badges['/']).toBe('static');
    expect(badges['/about']).toBe('static');
    expect(Object.values(badges).every((b) => b === 'static')).toBe(true);
  });
});
