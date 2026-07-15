import { describe, it, expect } from 'vitest';
import { renderAppShell as renderDashboardShell } from '@svelte-vitals/core';
import type { DashboardSnapshot } from '../src/ui/snapshot.js';

const baseSnapshot: DashboardSnapshot = {
  report: {
    version: '1',
    score: 80,
    weights: { seo: 1 },
    categories: { seo: { score: 80, scoreModel: 'weighted' as never } },
    summary: { critical: 0, warning: 0, info: 0, passed: 0, dynamic: 0 } as never,
    routes: [
      {
        route: '/a',
        score: 80,
        issues: [
          {
            id: 'SEO001',
            category: 'seo',
            title: 'Missing <title>',
            severity: 'critical',
            detection: { presence: 'none', value: 'absent' }
          } as never
        ]
      }
    ],
    siteIssues: []
  },
  badges: { '/a': 'static' },
  analyzing: false,
  live: true,
  sequence: 1,
  meta: { version: '9.9.9', coreVersion: '0.21.0' }
};

function extractEmbeddedJson(html: string): unknown {
  const start = html.indexOf('<script type="application/json" id="svelte-vitals-data">');
  const contentStart = html.indexOf('>', start) + 1;
  const end = html.indexOf('</script>', contentStart);
  return JSON.parse(html.slice(contentStart, end));
}

describe('renderDashboardShell', () => {
  it('returns a full HTML document with the container elements the client script mounts into', () => {
    const html = renderDashboardShell(baseSnapshot);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('id="dv-topbar"');
    expect(html).toContain('id="dv-sidebar"');
    expect(html).toContain('id="dv-detail"');
  });

  it('embeds a parseable snapshot matching the input', () => {
    const html = renderDashboardShell(baseSnapshot);
    const embedded = extractEmbeddedJson(html);
    expect(embedded).toEqual(baseSnapshot);
  });

  it('escapes </script> inside embedded finding data so it cannot break out of the tag', () => {
    const snapshot: DashboardSnapshot = {
      ...baseSnapshot,
      report: {
        ...baseSnapshot.report,
        routes: [
          {
            route: '/a',
            score: 80,
            issues: [
              {
                id: 'SEO001',
                category: 'seo',
                title: '</script><script>alert(1)</script>',
                severity: 'critical',
                detection: { presence: 'none', value: 'absent' }
              } as never
            ]
          }
        ]
      }
    };
    const html = renderDashboardShell(snapshot);
    expect(html).not.toContain('</script><script>alert(1)</script>');
    const embedded = extractEmbeddedJson(html) as typeof snapshot;
    expect(embedded.report.routes[0]!.issues[0]!.title).toBe('</script><script>alert(1)</script>');
  });

  it('includes the dashboard stylesheet and client script', () => {
    const html = renderDashboardShell(baseSnapshot);
    expect(html).toContain('.dv-app{');
    expect(html).toContain("new EventSource('/__svelte-vitals/events')");
    expect(html).toContain("fetch('/__svelte-vitals/data.json')");
  });

  it('embeds the same wordmark SVG as the docs site, not the old bolt-glyph brand', () => {
    const html = renderDashboardShell(baseSnapshot);
    expect(html).toContain('viewBox="0 0 380 56"'); // matches docs/public/wordmark.svg's viewBox
    expect(html).toContain('dv-wordmark-title');
    expect(html).not.toContain("text: '↯'"); // old bolt-glyph brand, replaced
  });

  it('the embedded client script is syntactically valid JS once a real finding is present', () => {
    // Regression guard: DASHBOARD_SCRIPT is one giant template literal, so a stray
    // unescaped backtick or quote inside a comment/string anywhere in it (e.g. in the
    // AI-prompt builder) silently breaks the whole script for the browser without
    // failing the TypeScript build, since the string's *contents* aren't type-checked.
    const snapshot: DashboardSnapshot = {
      ...baseSnapshot,
      report: {
        ...baseSnapshot.report,
        routes: [
          {
            route: '/a',
            score: 50,
            issues: [
              {
                id: 'SEO001',
                category: 'seo',
                title: 'Missing <title>',
                severity: 'critical',
                location: 'src/routes/+page.svelte',
                line: 3,
                recommendation: 'Add a title',
                fix: {
                  description: 'Add a title',
                  snippet: '<svelte:head><title>Hi</title></svelte:head>',
                  lang: 'svelte'
                },
                docsUrl: 'https://example.com',
                detection: { presence: 'none', value: 'absent' }
              } as never
            ]
          }
        ]
      }
    };
    const html = renderDashboardShell(snapshot);
    const start = html.lastIndexOf('<script>') + '<script>'.length;
    const end = html.lastIndexOf('</script>');
    const script = html.slice(start, end);
    // `new Function` here only parses (never calls) a string built entirely from this
    // test's own fixture data and the repo's own DASHBOARD_SCRIPT constant — a syntax
    // check, not execution of untrusted input.
    expect(() => new Function(script)).not.toThrow();
  });
});
