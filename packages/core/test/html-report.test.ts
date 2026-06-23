import { describe, it, expect } from 'vitest';
import { buildHtmlDocument, formatHtmlReport, escapeHtml, safeHref, scoreBand } from '../src/index.js';
import type { JsonReport } from '../src/reporter/json.js';
import type { ScoreModel } from '../src/scoring/score.js';

const model = (criticalCap: number | null = null): ScoreModel => ({ routeAverage: 0, sitePenalty: 0, criticalCap });

const report: JsonReport = {
  version: '9.9.9',
  score: 82,
  weights: { seo: 1, performance: 1 },
  categories: {
    seo: { score: 91, scoreModel: model() },
    performance: { score: 68, scoreModel: model() }
  },
  summary: { critical: 1, warning: 2, info: 1, passed: 37, dynamic: 3 },
  routes: [
    { route: '/', score: 100, issues: [] },
    {
      route: '/products/[id]',
      score: 40,
      issues: [
        {
          id: 'SEO001',
          category: 'seo',
          title: 'Missing <title>',
          detection: { presence: 'none', value: 'absent' },
          location: 'src/routes/products/[id]/+page.svelte',
          recommendation: 'Add a <title> in <svelte:head>.',
          docsUrl: 'https://oekazuma.github.io/svelte-vitals/rules/seo001',
          fix: {
            description: 'Add a <title>.',
            snippet: '<svelte:head>\n  <title>{data.title}</title>\n</svelte:head>',
            lang: 'svelte'
          },
          severity: 'critical'
        }
      ]
    }
  ],
  siteIssues: [
    {
      id: 'SEO007',
      category: 'seo',
      title: 'No sitemap',
      detection: { presence: 'none', value: 'absent' },
      location: 'project',
      recommendation: 'Add a sitemap.',
      severity: 'info'
    }
  ]
};

describe('buildHtmlDocument', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });

  it('is a full self-contained HTML document with a title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>svelte-vitals report</title>');
    expect(html).toContain('</html>');
  });

  it('renders the Health score and category scores', () => {
    expect(html).toContain('>82<'); // health number
    expect(html).toContain('SEO');
    expect(html).toContain('>91<');
    expect(html).toContain('Performance');
    expect(html).toContain('>68<');
  });

  it('renders a row per route and a card per finding', () => {
    expect(html).toContain('/products/[id]');
    expect(html).toContain('SEO001');
    expect(html).toContain('Missing &lt;title&gt;'); // escaped
    expect(html).toContain('SEO007'); // site-wide finding
    expect(html).toContain('data-severity="critical"');
    expect(html).toContain('data-category="seo"');
  });

  it('escapes the fix snippet and renders it in a code block', () => {
    expect(html).toContain('&lt;svelte:head&gt;');
    expect(html).toContain('&lt;title&gt;{data.title}&lt;/title&gt;');
    expect(html).not.toContain('<title>{data.title}</title>'); // raw snippet must not leak
  });

  it('links findings to their docsUrl', () => {
    expect(html).toContain('href="https://oekazuma.github.io/svelte-vitals/rules/seo001"');
  });

  it('is self-contained: no external resource references', () => {
    // strip docsUrl anchors, then assert nothing else points at http(s)
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(withoutDocs)).toBe(false);
    expect(/url\(\s*['"]?https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});

describe('escapeHtml / scoreBand', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
  it('bands scores', () => {
    expect(scoreBand(95)).toBe('good');
    expect(scoreBand(90)).toBe('good');
    expect(scoreBand(89)).toBe('warn');
    expect(scoreBand(50)).toBe('warn');
    expect(scoreBand(49)).toBe('poor');
  });
});

describe('formatHtmlReport', () => {
  it('matches buildHtmlDocument over the built JsonReport (smoke)', () => {
    // formatHtmlReport builds the JsonReport internally; here we only assert it returns a full doc.
    // A fuller integration check lives in the CLI tests.
    const out = formatHtmlReport(
      [],
      { treatDynamicAs: 'pass', metaComponents: [], rules: {}, failOn: 'critical' } as never,
      { version: '9.9.9' }
    );
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('</html>');
  });
});

describe('styling', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  it('inlines a stylesheet with the brand + score tokens', () => {
    expect(html).toContain('--accent: #ff3e00');
    expect(html).toContain('.finding');
    expect(html).toContain('#2FA968'); // good band used somewhere (inline) — sanity that colors are present
    // still self-contained after adding CSS
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/url\(\s*['"]?https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});

describe('interactivity', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });
  it('inlines the gauge + filter script and stays self-contained', () => {
    expect(html).toContain('prefers-reduced-motion');
    expect(html).toContain('data-severity');
    expect(html).toContain("getElementById('arc')");
    const withoutDocs = html.replace(/href="https?:\/\/oekazuma\.github\.io[^"]*"/g, '');
    expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(withoutDocs)).toBe(false);
  });
});

describe('safety hardening (buildHtmlDocument is a public API; JsonReport is loosely typed)', () => {
  it('drops a finding docsUrl with an unsafe scheme', () => {
    const evil: JsonReport = {
      ...report,
      routes: [
        {
          route: '/x',
          score: 0,
          issues: [
            {
              id: 'SEO001',
              category: 'seo',
              title: 't',
              detection: { presence: 'none', value: 'absent' },
              location: 'f.svelte',
              recommendation: 'r',
              docsUrl: 'javascript:alert(1)',
              severity: 'critical'
            }
          ]
        }
      ],
      siteIssues: []
    };
    const html = buildHtmlDocument(evil, { version: '0' });
    expect(html).not.toContain('javascript:alert(1)');
    expect(html).not.toContain('href="javascript:'); // no anchor rendered for the unsafe url
  });

  it('escapes an attacker-controlled category key', () => {
    const evil: JsonReport = {
      ...report,
      categories: { '<img src=x onerror=alert(1)>': { score: 50, scoreModel: model() } },
      weights: {},
      routes: [],
      siteIssues: []
    };
    const html = buildHtmlDocument(evil, { version: '0' });
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('safeHref accepts http/https and rejects others', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });
});
