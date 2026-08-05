import { describe, it, expect } from 'vitest';
import {
  buildHtmlDocument,
  formatHtmlReport,
  renderAppShell,
  escapeHtml,
  safeHref,
  scoreBand,
  defineConfig
} from '../src/index.js';
import type { AppSnapshot, Result } from '../src/index.js';
import type { JsonReport } from '../src/reporter/json.js';
import type { ScoreModel } from '../src/scoring/score.js';

const model = (criticalCap: number | null = null): ScoreModel => ({ routeAverage: 0, sitePenalty: 0, criticalCap });

const report: JsonReport = {
  version: '9.9.9',
  score: 82,
  weights: { seo: 1, performance: 1 },
  categories: {
    seo: { score: 91, scoreModel: model(), keys: 0, affectedKeys: 0 },
    performance: { score: 68, scoreModel: model(), keys: 0, affectedKeys: 0 }
  },
  summary: { critical: 1, warning: 2, info: 1, passed: 37, dynamic: 3 },
  rules: {},
  routes: [
    { route: '/', score: 100, categories: {}, issues: [] },
    {
      route: '/products/[id]',
      score: 40,
      categories: {},
      issues: [
        {
          id: 'seo/title-presence',
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
      id: 'seo/sitemap-xml',
      category: 'seo',
      title: 'No sitemap',
      detection: { presence: 'none', value: 'absent' },
      location: 'project',
      recommendation: 'Add a sitemap.',
      severity: 'info'
    }
  ]
};

/** The snapshot the client script boots from, parsed back out of the document. */
function extractEmbeddedSnapshot(html: string): AppSnapshot {
  const start = html.indexOf('<script type="application/json" id="svelte-vitals-data">');
  const contentStart = html.indexOf('>', start) + 1;
  const end = html.indexOf('</script>', contentStart);
  return JSON.parse(html.slice(contentStart, end)) as AppSnapshot;
}

/** The client script's source, extracted the way a browser would receive it. */
function extractClientScript(html: string): string {
  const start = html.lastIndexOf('<script>') + '<script>'.length;
  const end = html.lastIndexOf('</script>');
  return html.slice(start, end);
}

describe('buildHtmlDocument (static export of the shared app shell)', () => {
  const html = buildHtmlDocument(report, { version: '9.9.9' });

  it('is a full self-contained HTML document with a title', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<title>svelte-vitals report</title>');
    expect(html).toContain('</html>');
  });

  it('mounts the same shell containers as the live dashboard', () => {
    expect(html).toContain('id="dv-topbar"');
    expect(html).toContain('id="dv-sidebar"');
    expect(html).toContain('id="dv-detail"');
  });

  it('embeds the report as a parseable snapshot with live: false and no badges', () => {
    const snapshot = extractEmbeddedSnapshot(html);
    expect(snapshot.report).toEqual(report);
    expect(snapshot.live).toBe(false);
    expect(snapshot.badges).toEqual({});
    expect(snapshot.analyzing).toBe(false);
    expect(snapshot.meta).toEqual({ version: '9.9.9' });
  });

  it('the embedded client script parses as valid JS with this report in place', () => {
    const script = extractClientScript(html);
    // Parse-only (never called): a syntax check of our own generated shell, not
    // execution of untrusted input.
    expect(() => new Function(script)).not.toThrow();
  });

  it('the client script skips the SSE wiring when the snapshot is not live', () => {
    const script = extractClientScript(html);
    expect(script).toContain("state.snapshot.live && typeof EventSource !== 'undefined'");
  });

  it('is self-contained: no external resource references in the markup', () => {
    // docsUrl now lives inside the embedded JSON (with `<` escaped to the literal
    // sequence \u003c), never in a server-rendered href — so the whole document must
    // have no http(s) src/href at all.
    expect(/(?:src|href)\s*=\s*"https?:\/\//i.test(html)).toBe(false);
    expect(/url\(\s*['"]?https?:\/\//i.test(html)).toBe(false);
  });
});

describe('coreVersion (rule-engine version, distinct from the tool version)', () => {
  it('carries meta.coreVersion into the snapshot when given', () => {
    const html = buildHtmlDocument(report, { version: '9.9.9', coreVersion: '0.21.0' });
    expect(extractEmbeddedSnapshot(html).meta).toEqual({ version: '9.9.9', coreVersion: '0.21.0' });
  });

  it('omits it when absent (backward compatible)', () => {
    const html = buildHtmlDocument(report, { version: '9.9.9' });
    expect(extractEmbeddedSnapshot(html).meta).toEqual({ version: '9.9.9' });
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
  it('returns a full document over the built JsonReport (smoke)', () => {
    const out = formatHtmlReport(
      [],
      { treatDynamicAs: 'pass', metaComponents: [], rules: {}, failOn: 'critical' } as never,
      { version: '9.9.9' }
    );
    expect(out.startsWith('<!doctype html>')).toBe(true);
    expect(out).toContain('</html>');
    expect(extractEmbeddedSnapshot(out).live).toBe(false);
  });

  it('carries per-route category scores into the embedded snapshot', () => {
    // `sanitizeReport` spreads each route, so this passes today — it exists to fail if that spread is
    // ever replaced by an explicit field list.
    const results: Result[] = [
      {
        id: 'seo/canonical-url',
        category: 'seo',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'x'
      }
    ];
    const html = formatHtmlReport(results, defineConfig({}), { version: '0.0.0' });
    expect(html).toContain('"categories":{"seo":95}');
  });
});

describe('parity with the live dashboard shell', () => {
  it('renderAppShell with live: true produces the dashboard document (same style + script, dashboard title)', () => {
    const staticHtml = buildHtmlDocument(report, { version: '9.9.9' });
    const liveHtml = renderAppShell({
      report,
      badges: {},
      analyzing: false,
      sequence: 0,
      live: true,
      meta: { version: '9.9.9' }
    });
    expect(liveHtml).toContain('<title>svelte-vitals dashboard</title>');
    // Identical except the title and the embedded snapshot's `live` flag.
    const normalize = (h: string) =>
      h
        .replace('<title>svelte-vitals dashboard</title>', '<title></title>')
        .replace('<title>svelte-vitals report</title>', '<title></title>')
        .replace('"live":true', '"live":false');
    expect(normalize(liveHtml)).toBe(normalize(staticHtml));
  });
});

describe('safety hardening (buildHtmlDocument is a public API; JsonReport is loosely typed)', () => {
  it('drops a finding docsUrl with an unsafe scheme before embedding', () => {
    const evil: JsonReport = {
      ...report,
      routes: [
        {
          route: '/x',
          score: 0,
          categories: {},
          issues: [
            {
              id: 'seo/title-presence',
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
    expect(extractEmbeddedSnapshot(html).report.routes[0]!.issues[0]!.docsUrl).toBeUndefined();
  });

  it('a </script> injection in finding data cannot break out of the JSON element', () => {
    const evil: JsonReport = {
      ...report,
      routes: [
        {
          route: '/a',
          score: 80,
          categories: {},
          issues: [
            {
              id: 'seo/title-presence',
              category: 'seo',
              title: '</script><script>alert(1)</script>',
              detection: { presence: 'none', value: 'absent' },
              location: 'f.svelte',
              recommendation: 'r',
              severity: 'critical'
            }
          ]
        }
      ],
      siteIssues: []
    };
    const html = buildHtmlDocument(evil, { version: '0' });
    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(extractEmbeddedSnapshot(html).report.routes[0]!.issues[0]!.title).toBe('</script><script>alert(1)</script>');
  });

  it('an attacker-controlled category key cannot appear as raw markup', () => {
    const evil: JsonReport = {
      ...report,
      categories: { '<img src=x onerror=alert(1)>': { score: 50, scoreModel: model(), keys: 0, affectedKeys: 0 } },
      weights: {},
      routes: [],
      siteIssues: []
    };
    const html = buildHtmlDocument(evil, { version: '0' });
    // embedJson escapes `<` to the literal sequence \u003c, so the raw tag never
    // exists in the document (the parsed JSON still contains the original string).
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });

  it('safeHref accepts http/https and rejects others', () => {
    expect(safeHref('https://example.com/a')).toBe('https://example.com/a');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,x')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });

  it('rejects whitespace-obfuscated and uppercase unsafe schemes; accepts uppercase http(s)', () => {
    // Browsers strip ASCII tab/newline before scheme resolution — these must not slip through.
    expect(safeHref('java\tscript:alert(1)')).toBeNull();
    expect(safeHref('java\nscript:alert(1)')).toBeNull();
    expect(safeHref('JavaScript:alert(1)')).toBeNull();
    // Scheme match is case-insensitive: uppercase http(s) is valid and returned verbatim.
    expect(safeHref('HTTPS://example.com')).toBe('HTTPS://example.com');
  });
});

describe('routeBadges (dev-dashboard provenance)', () => {
  it('omitting opts produces byte-identical output to passing opts: {}', () => {
    const withoutOpts = buildHtmlDocument(report, { version: '9.9.9' });
    const withEmptyOpts = buildHtmlDocument(report, { version: '9.9.9' }, {});
    expect(withEmptyOpts).toBe(withoutOpts);
  });

  it('carries known badges into the snapshot', () => {
    const html = buildHtmlDocument(
      report,
      { version: '9.9.9' },
      { routeBadges: { '/': 'measured', '/products/[id]': 'static' } }
    );
    expect(extractEmbeddedSnapshot(html).badges).toEqual({ '/': 'measured', '/products/[id]': 'static' });
  });

  it('drops an unknown badge value instead of embedding it', () => {
    const html = buildHtmlDocument(report, { version: '9.9.9' }, { routeBadges: { '/': 'bogus' as never } });
    expect(extractEmbeddedSnapshot(html).badges).toEqual({});
    expect(html).not.toContain('bogus');
  });
});
