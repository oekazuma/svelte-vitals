// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { type JsonReport } from '@svelte-vitals/core';
import { buildHtmlDocument } from '@svelte-vitals/core/internal';

/**
 * Boots the shared app shell (see app-shell-static.test.ts for why this lives in
 * packages/vite: core has no DOM test environment) and pins the category-overview reach
 * line added for issue #388 — "N of M keys affected" beside each category's score,
 * the affectedKeys/keys fields the score floor design moved magnitude into
 * (docs/superpowers/specs/2026-08-05-score-floor-and-reach-design.md).
 */

const model = { routeAverage: 0, sitePenalty: 0, criticalCap: null };

function baseReport(categories: JsonReport['categories']): JsonReport {
  return {
    version: '1',
    score: 90,
    weights: { architecture: 1 },
    categories,
    summary: { critical: 0, warning: 0, info: 0, passed: 0, dynamic: 0 } as never,
    rules: {},
    inventories: {},
    routes: [],
    siteIssues: []
  };
}

function bootStatic(report: JsonReport): void {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  document.documentElement.innerHTML = html.replace(/^<!doctype html><html[^>]*>/, '').replace('</html>', '');
  const start = html.lastIndexOf('<script>') + '<script>'.length;
  const end = html.lastIndexOf('</script>');
  // Parse+run of our own generated shell against this test's own fixture — not
  // execution of untrusted input.
  new Function(html.slice(start, end))();
}

describe('dashboard overview — category reach line', () => {
  it('renders "N of M keys affected" beside a category with affectedKeys/keys present', () => {
    bootStatic(baseReport({ architecture: { score: 99, scoreModel: model, keys: 334, affectedKeys: 41 } }));
    const reach = document.querySelector('.dv-cat-reach');
    expect(reach).not.toBeNull();
    expect(reach!.textContent).toBe('41 of 334 keys affected');
  });

  it('renders the zero-affected state ("0 of N") rather than hiding it', () => {
    bootStatic(baseReport({ architecture: { score: 100, scoreModel: model, keys: 334, affectedKeys: 0 } }));
    const reach = document.querySelector('.dv-cat-reach');
    expect(reach).not.toBeNull();
    expect(reach!.textContent).toBe('0 of 334 keys affected');
  });

  it('renders no reach line, and no "undefined", when keys is 0', () => {
    bootStatic(baseReport({ architecture: { score: 100, scoreModel: model, keys: 0, affectedKeys: 0 } }));
    const cats = document.querySelector('.dv-cats')!;
    expect(cats.querySelector('.dv-cat-reach')).toBeNull();
    expect(cats.textContent).not.toContain('undefined');
  });

  it('renders no reach line, and no "undefined", when the fields are absent entirely', () => {
    // A hand-built snapshot older than the score-floor design (or a test fixture) — the
    // category object carries only score/scoreModel, same shape dashboard-script-ai-prompt
    // and dashboard-script-staleness use.
    const report = baseReport({ architecture: { score: 100 } as never });
    bootStatic(report);
    const cats = document.querySelector('.dv-cats')!;
    expect(cats.querySelector('.dv-cat-reach')).toBeNull();
    expect(cats.textContent).not.toContain('undefined');
  });
});
