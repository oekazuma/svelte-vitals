import { describe, it, expect } from 'vitest';
import { formatAgentReport, formatJsonReport, defineConfig, type Result } from '../src/index.js';

const config = defineConfig({});
const results: Result[] = [
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    route: '/a',
    location: 'src/routes/a/+page.svelte',
    message: '<title>'
  },
  {
    id: 'SEO002',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/a',
    location: 'src/routes/a/+page.svelte',
    message: 'Missing <meta name="description">',
    docsUrl: 'https://svelte-vitals.dev/rules/SEO002',
    fix: { description: 'Add a description meta.', snippet: '<meta name="description" content="x" />', lang: 'svelte' }
  },
  {
    id: 'SEO006',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing robots.txt',
    fix: { description: 'Create static/robots.txt.', snippet: 'User-agent: *', lang: 'text' }
  }
];

describe('formatAgentReport', () => {
  it('lists only failing findings, grouped, with fix snippet and acceptance', () => {
    const md = formatAgentReport(results, config);
    expect(md).toContain('## src/routes/a/+page.svelte');
    expect(md).toContain('### SEO002 · Missing `<meta name="description">` (critical)');
    expect(md).toContain('Add a description meta.');
    expect(md).toContain('```svelte');
    expect(md).toContain('## (project)'); // SEO006 has no route/location
    expect(md).toContain('```text');
    expect(md).toContain('SEO002 passes');
    expect(md).not.toContain('SEO001'); // passing finding excluded
  });

  it('reports a clean project', () => {
    const md = formatAgentReport([results[0]!], config);
    expect(md).toMatch(/No issues/);
  });

  it('orders groups most-severe-first, despite alphabetical file names', () => {
    // The critical lives in 'src/routes/a/...'; the warning is the '(project)' group,
    // which sorts first alphabetically. Severity ordering must surface the critical first.
    const md = formatAgentReport(results, config);
    expect(md.indexOf('## src/routes/a/+page.svelte')).toBeLessThan(md.indexOf('## (project)'));
    expect(md).toContain('Fix critical issues first');
  });

  it('wraps tag-like tokens in inline code so renderers do not strip them', () => {
    const withTags: Result[] = [
      {
        id: 'SEO001',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        location: 'src/routes/a/+page.svelte',
        message: 'Missing <title>',
        recommendation: 'Add a <title> inside <svelte:head>.'
      }
    ];
    const md = formatAgentReport(withTags, config);
    expect(md).toContain('### SEO001 · Missing `<title>`');
    expect(md).toContain('- Fix: Add a `<title>` inside `<svelte:head>`.');
    // No bare tag survives outside of fenced code / inline code.
    expect(md).not.toMatch(/Missing <title> \(/);
  });

  it('orders findings within a group by severity', () => {
    const file = 'src/routes/x/+page.svelte';
    const sameGroup: Result[] = [
      {
        id: 'SEO004',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        location: file,
        message: 'Missing <meta property="og:image">'
      },
      {
        id: 'SEO001',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/x',
        location: file,
        message: 'Missing <title>'
      }
    ];
    const md = formatAgentReport(sameGroup, config);
    expect(md.indexOf('### SEO001')).toBeLessThan(md.indexOf('### SEO004'));
  });
});

describe('formatJsonReport includes fix', () => {
  it('carries fix on penalized issues', () => {
    const json = JSON.parse(formatJsonReport(results, config, { version: '0.0.0' }));
    const seo002 = json.routes
      .find((r: { route: string }) => r.route === '/a')
      .issues.find((i: { id: string }) => i.id === 'SEO002');
    expect(seo002.fix.description).toBe('Add a description meta.');
    expect(json.siteIssues[0].fix.description).toBe('Create static/robots.txt.');
  });
});
