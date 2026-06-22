import { describe, it, expect } from 'vitest';
import { formatConsoleReport, defineConfig, type Result } from '../src/index.js';

const config = defineConfig({});
const results: Result[] = [
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    route: '/a',
    message: '<title>'
  },
  {
    id: 'SEO002',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/a',
    location: 'src/routes/a/+page.svelte',
    message: 'Missing <meta name="description">'
  },
  { id: 'SEO006', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'Missing robots.txt' }
];

describe('formatConsoleReport', () => {
  it('shows a score header and groups findings', () => {
    const out = formatConsoleReport(results, config);
    expect(out).toMatch(/SEO Score: \d+\/100/);
    expect(out).toContain('Critical (1)');
    expect(out).toContain('Missing <meta name="description">');
  });
  it('renders a per-route tree under --by-route', () => {
    const out = formatConsoleReport(results, config, { byRoute: true });
    expect(out).toContain('By route');
    expect(out).toMatch(/\/a\s+\d+/);
  });
  it('adds a Performance score section when performance findings exist', () => {
    const withPerf: Result[] = [
      ...results,
      {
        id: 'PERF001',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        line: 42,
        message: 'Missing <img> width/height'
      }
    ];
    const out = formatConsoleReport(withPerf, config);
    expect(out).toMatch(/SEO Score: \d+\/100/);
    expect(out).toMatch(/Performance Score: \d+\/100/);
    expect(out).toContain('PERF001');
    expect(out).toContain('src/routes/blog/+page.svelte:42');
  });
});
