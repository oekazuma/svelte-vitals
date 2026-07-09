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
  it('shows a combined Health headline above the category scores', () => {
    const out = formatConsoleReport(results, config);
    expect(out).toMatch(/Health: \d+\/100/);
    expect(out).toMatch(/SEO Score: \d+\/100/); // per-category line still present
  });
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

  it('adds a Correctness score section when correctness findings exist', () => {
    const withCorrect: Result[] = [
      ...results,
      {
        id: 'CORRECT001',
        category: 'correctness',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: 'src/lib/List.svelte',
        location: 'src/lib/List.svelte',
        line: 5,
        message: '{#each} block has no key'
      }
    ];
    const out = formatConsoleReport(withCorrect, config);
    expect(out).toMatch(/Correctness Score: \d+\/100/);
    expect(out).toContain('CORRECT001');
  });

  it('collapses a rule that fires on multiple routes into one group with an "…and N more" line', () => {
    const multi: Result[] = [
      { id: 'SEO001', severity: 'critical', detection: { presence: 'none', value: 'absent' }, route: '/a', message: 'Missing <title>' },
      { id: 'SEO001', severity: 'critical', detection: { presence: 'none', value: 'absent' }, route: '/b', message: 'Missing <title>' },
      { id: 'SEO001', severity: 'critical', detection: { presence: 'none', value: 'absent' }, route: '/c', message: 'Missing <title>' }
    ];
    const out = formatConsoleReport(multi, config);
    expect(out).toContain('Critical (3)');
    // Only the first route's line is shown by default, plus a collapse line — not all three routes.
    expect(out).toContain('✗ SEO001  Missing <title>');
    expect(out).toContain('/a');
    expect(out).not.toContain('/b');
    expect(out).not.toContain('/c');
    expect(out).toContain('…and 2 more');
  });

  it('caps rule groups per severity bucket at 5 by default, with a trailer line', () => {
    const many: Result[] = Array.from({ length: 7 }, (_, i) => ({
      id: `SEO0${i}`,
      severity: 'critical' as const,
      detection: { presence: 'none', value: 'absent' } as const,
      route: `/r${i}`,
      message: `Rule ${i} failed`
    }));
    const out = formatConsoleReport(many, config);
    expect(out).toContain('Critical (7)');
    expect(out).toContain('SEO00');
    expect(out).toContain('SEO04'); // 5th shown group (0-indexed: SEO00..SEO04)
    expect(out).not.toContain('SEO05');
    expect(out).not.toContain('SEO06');
    expect(out).toContain('…and 2 more rules affected — run with --verbose to see all');
  });

  it('verbose:true restores today\'s full per-result listing, uncapped and ungrouped', () => {
    const multi: Result[] = [
      { id: 'SEO001', severity: 'critical', detection: { presence: 'none', value: 'absent' }, route: '/a', message: 'Missing <title>' },
      { id: 'SEO001', severity: 'critical', detection: { presence: 'none', value: 'absent' }, route: '/b', message: 'Missing <title>' }
    ];
    const out = formatConsoleReport(multi, config, { verbose: true });
    expect(out).toContain('/a');
    expect(out).toContain('/b');
    expect(out).not.toContain('…and');
  });
});
