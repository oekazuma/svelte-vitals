import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../src/ui/snapshot.js';
import { createStore } from '../src/ui/store.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const r = (id: string, route: string, extra: Partial<Result> = {}): Result =>
  ({
    id,
    message: id,
    category: 'seo',
    detection: { presence: 'none', value: 'absent' },
    route,
    severity: 'critical',
    ...extra
  }) as Result;

describe('buildSnapshot', () => {
  it('composes report/badges/analyzing/sequence/meta from the store', () => {
    const store = createStore();
    store.setStatic([r('seo/title-presence', '/a')]);
    store.setAnalyzing(true);
    const snapshot = buildSnapshot(store, defineConfig({}), { version: '9.9.9', coreVersion: '0.21.0' });

    expect(
      snapshot.report.routes.some((route) => route.route === '/a' && route.issues.some((i) => i.id === 'seo/title-presence'))
    ).toBe(true);
    expect(snapshot.badges).toEqual({ '/a': 'static' });
    expect(snapshot.analyzing).toBe(true);
    expect(snapshot.sequence).toBe(store.sequence());
    expect(snapshot.meta).toEqual({ version: '9.9.9', coreVersion: '0.21.0' });
  });

  it('drops a docsUrl using an unsafe scheme while keeping a safe https:// one', () => {
    const store = createStore();
    store.setStatic([
      r('seo/title-presence', '/a', { docsUrl: 'javascript:alert(1)' }),
      r('seo/description-presence', '/a', { docsUrl: 'https://svelte-vitals.dev/rules/seo/description-presence' })
    ]);
    const snapshot = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    const issues = snapshot.report.routes.find((route) => route.route === '/a')!.issues;
    expect(issues.find((i) => i.id === 'seo/title-presence')!.docsUrl).toBeUndefined();
    expect(issues.find((i) => i.id === 'seo/description-presence')!.docsUrl).toBe('https://svelte-vitals.dev/rules/seo/description-presence');
  });

  it('sequence reflects the snapshot at build time, not a live reference', () => {
    const store = createStore();
    store.setStatic([r('seo/title-presence', '/a')]);
    const first = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    store.setStatic([r('seo/description-presence', '/b')]);
    const second = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });
});
