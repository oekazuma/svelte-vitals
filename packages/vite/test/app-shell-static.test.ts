// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { type JsonReport } from '@svelte-vitals/core';
import { buildHtmlDocument } from '@svelte-vitals/core/internal';

/**
 * Boots the shared app shell in its static mode — what the CLI's `--reporter html`
 * ships — and pins the live/static contract: same layout and interactions as the
 * dashboard, but no EventSource connection, no /data.json refetch, and no
 * connection/analyzing indicators. Lives here (not packages/core) because core has
 * no DOM test environment; the shell itself is core's.
 */

const report: JsonReport = {
  version: '1',
  score: 50,
  weights: { seo: 1 },
  categories: {
    seo: { score: 50, scoreModel: { routeAverage: 50, sitePenalty: 0, criticalCap: null }, keys: 0, affectedKeys: 0 }
  },
  summary: { critical: 1, warning: 0, info: 0, passed: 0, dynamic: 0 } as never,
  rules: {},
  inventories: {},
  routes: [
    {
      route: '/blog/hello',
      score: 50,
      categories: {},
      issues: [
        {
          id: 'seo/title-presence',
          category: 'seo',
          title: 'Missing <title>',
          detection: { presence: 'none', value: 'absent' },
          location: 'src/routes/blog/hello/+page.svelte',
          recommendation: 'Add a <title>.',
          severity: 'critical'
        } as never
      ]
    }
  ],
  siteIssues: []
};

function bootStatic(): void {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  document.documentElement.innerHTML = html.replace(/^<!doctype html><html[^>]*>/, '').replace('</html>', '');
  const start = html.lastIndexOf('<script>') + '<script>'.length;
  const end = html.lastIndexOf('</script>');
  // Parse+run of our own generated shell against this test's own fixture — not
  // execution of untrusted input.
  new Function(html.slice(start, end))();
}

describe('app shell — static (--reporter html) mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the full dashboard layout: topbar, sidebar with the route, detail pane', () => {
    bootStatic();
    expect(document.querySelector('.dv-topbar-inner')).not.toBeNull();
    expect(document.querySelector('.dv-nav')).not.toBeNull();
    expect(document.querySelector('.dv-nav')!.textContent).toContain('/blog/hello');
    expect(document.querySelector('.dv-gauge')).not.toBeNull();
  });

  it('never opens an EventSource or refetches data.json, and shows no connection or analyzing indicator', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const esInstances: string[] = [];
    class FakeEventSource {
      constructor(url: string) {
        esInstances.push(url);
      }
      addEventListener(): void {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);
    bootStatic();
    expect(esInstances).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector('.dv-conn')).toBeNull();
    expect(document.querySelector('.dv-analyzing')).toBeNull();
  });

  it('finding cards still carry the AI Prompt disclosure', () => {
    bootStatic();
    location.hash = 'route/route-blog-hello';
    window.dispatchEvent(new Event('hashchange'));
    const details = document.querySelector('.dv-ai-prompt');
    expect(details).not.toBeNull();
    expect(details!.querySelector('summary')!.textContent).toBe('AI Prompt');
  });
});
