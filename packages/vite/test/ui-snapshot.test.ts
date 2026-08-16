import { describe, it, expect } from 'vitest';
import { buildSnapshot } from '../src/ui/snapshot.js';
import { createStore } from '../src/ui/store.js';
import { defineConfig, type Result } from '@svelte-vitals/core';
import { withFailedRulesOff, buildJsonReport } from '@svelte-vitals/core/internal';

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
      snapshot.report.routes.some(
        (route) => route.route === '/a' && route.issues.some((i) => i.id === 'seo/title-presence')
      )
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
    expect(issues.find((i) => i.id === 'seo/description-presence')!.docsUrl).toBe(
      'https://svelte-vitals.dev/rules/seo/description-presence'
    );
  });

  it('sequence reflects the snapshot at build time, not a live reference', () => {
    const store = createStore();
    store.setStatic([r('seo/title-presence', '/a')]);
    const first = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    store.setStatic([r('seo/description-presence', '/b')]);
    const second = buildSnapshot(store, defineConfig({}), { version: '9.9.9' });
    expect(second.sequence).toBeGreaterThan(first.sequence);
  });

  it('scores a live-layer failed rule as not-run, matching withFailedRulesOff', () => {
    const store = createStore();
    // 'warning' (not the r() default 'critical') so the critical-cap doesn't mask the
    // denominator shift this test is actually pinning.
    const finding = r('seo/canonical-url', '/a', { severity: 'warning' });
    store.setStatic([finding]);
    const config = defineConfig({});

    const control = buildSnapshot(store, config, { version: '9.9.9' });

    // seo/title-presence (a different, real rule) reported as failed — no result for it exists,
    // same as a rule that crashed and produced nothing.
    store.set('/a', [finding], ['seo/title-presence']);
    const withFailure = buildSnapshot(store, config, { version: '9.9.9' });

    expect(withFailure.report.score).not.toBe(control.report.score);
    const expectedConfig = withFailedRulesOff(config, ['seo/title-presence']);
    const expected = buildJsonReport(store.snapshot(), expectedConfig, { version: '9.9.9' });
    expect(withFailure.report.score).toBe(expected.score);
  });

  it('scores a static-layer failed rule as not-run when staticFailedRuleIds is passed', () => {
    const store = createStore();
    store.setStatic([r('seo/canonical-url', '/a', { severity: 'warning' })]);
    const config = defineConfig({});

    const control = buildSnapshot(store, config, { version: '9.9.9' });
    const withFailure = buildSnapshot(store, config, { version: '9.9.9' }, ['seo/title-presence']);

    expect(withFailure.report.score).not.toBe(control.report.score);
    const expected = buildJsonReport(store.snapshot(), withFailedRulesOff(config, ['seo/title-presence']), {
      version: '9.9.9'
    });
    expect(withFailure.report.score).toBe(expected.score);
  });

  it('preserves plugin-option weights once the static layer reports a failed rule (regression: config must never swap)', () => {
    const store = createStore();
    store.setStatic([r('seo/canonical-url', '/a', { severity: 'warning' })]);
    // A non-default seo weight, as a plugin-option config would carry — analyzeProject
    // (and any mocked equivalent) never sees this value, so the fix must thread it through
    // untouched rather than falling back to analyzeProject's own unweighted config.
    const weightedConfig = defineConfig({ weights: { seo: 5 } });

    const before = buildSnapshot(store, weightedConfig, { version: '9.9.9' });
    const after = buildSnapshot(store, weightedConfig, { version: '9.9.9' }, ['seo/title-presence']);

    expect(after.report.weights).toEqual(before.report.weights);
    expect(after.report.weights.seo).toBe(5);
  });
});
