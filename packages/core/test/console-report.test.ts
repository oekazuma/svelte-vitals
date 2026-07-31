import { describe, it, expect } from 'vitest';
import { formatConsoleReport, defineConfig, type Result } from '../src/index.js';

const config = defineConfig({});
const results: Result[] = [
  {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'own', value: 'static' },
    route: '/a',
    message: '<title>'
  },
  {
    id: 'seo/description-presence',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/a',
    location: 'src/routes/a/+page.svelte',
    message: 'Missing <meta name="description">'
  },
  {
    id: 'seo/robots-txt',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing robots.txt'
  }
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
  it('sorts --by-route worst-score-first, not alphabetically', () => {
    const mixed: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/z-bad',
        message: 'Missing <title>'
      },
      {
        id: 'seo/canonical-url',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        route: '/a-good',
        message: 'Has <title>'
      }
    ];
    const out = formatConsoleReport(mixed, config, { byRoute: true });
    const byRouteSection = out.split('By route')[1]!;
    // The worse route ('/z-bad', has a critical finding) must appear before the
    // better one ('/a-good') even though 'a' sorts before 'z' alphabetically.
    expect(byRouteSection.indexOf('/z-bad')).toBeLessThan(byRouteSection.indexOf('/a-good'));
  });

  it('floors the hidden tail average in "…and N more routes", so it cannot claim 100 over a penalized route', () => {
    // 10 bad routes (critical → low score) fill the visible cap. Two better routes are hidden in
    // the tail: one clean (100) and one with a single `info` finding (99). Their mean is 99.5 —
    // Math.round would print "avg score 100" even though the tail still contains a penalized
    // route; Math.floor must print 99.
    const badRoutes: Result[] = Array.from({ length: 10 }, (_, i) => ({
      id: 'seo/title-presence',
      severity: 'critical' as const,
      detection: { presence: 'none', value: 'absent' } as const,
      route: `/bad${i}`,
      message: 'Missing <title>'
    }));
    const penalizedGoodRoute: Result = {
      id: 'seo/canonical-url',
      severity: 'info',
      detection: { presence: 'none', value: 'absent' },
      route: '/good-penalized',
      message: 'Missing canonical URL'
    };
    const cleanGoodRoute: Result = {
      id: 'seo/canonical-url',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      route: '/good-clean',
      message: 'Has canonical URL'
    };
    const out = formatConsoleReport([...badRoutes, penalizedGoodRoute, cleanGoodRoute], config, { byRoute: true });
    const byRouteSection = out.split('By route')[1]!;
    expect(byRouteSection).toContain('avg score 99');
    expect(byRouteSection).not.toContain('avg score 100');
  });

  it('caps --by-route at 10 routes by default, with an "…and N more" trailer', () => {
    const manyRoutes: Result[] = Array.from({ length: 12 }, (_, i) => ({
      id: 'seo/canonical-url',
      severity: 'info' as const,
      detection: { presence: 'own', value: 'static' } as const,
      route: `/r${i}`,
      message: 'Has <title>'
    }));
    const out = formatConsoleReport(manyRoutes, config, { byRoute: true });
    const byRouteSection = out.split('By route')[1]!;
    expect(byRouteSection).toContain('…and 2 more route');
    expect(byRouteSection).toContain('run with --verbose to see all');
  });

  it('--by-route with verbose:true shows every route, still worst-first', () => {
    // Six routes with a critical failing finding (low score), named so they sort AFTER
    // the good routes alphabetically (`/z-bad*`). Seven routes with only passing findings
    // (score 100), named so they sort BEFORE the bad ones alphabetically (`/a-good*`).
    // Together that's 13 routes — more than the default 10-route cap — so this also
    // confirms the cap is truly lifted under verbose while order stays worst-first
    // throughout, not just alphabetical (which this fixture would otherwise be
    // indistinguishable from, since same-score routes fall back to a locale sort).
    const badRoutes: Result[] = Array.from({ length: 6 }, (_, i) => ({
      id: 'seo/title-presence',
      severity: 'critical' as const,
      detection: { presence: 'none', value: 'absent' } as const,
      route: `/z-bad${i}`,
      message: 'Missing <title>'
    }));
    const goodRoutes: Result[] = Array.from({ length: 7 }, (_, i) => ({
      id: 'seo/canonical-url',
      severity: 'info' as const,
      detection: { presence: 'own', value: 'static' } as const,
      route: `/a-good${i}`,
      message: 'Has <title>'
    }));
    const manyRoutes = [...badRoutes, ...goodRoutes];
    const out = formatConsoleReport(manyRoutes, config, { byRoute: true, verbose: true });
    const byRouteSection = out.split('By route')[1]!;
    for (const { route } of manyRoutes) expect(byRouteSection).toContain(route);
    expect(byRouteSection).not.toContain('…and');
    // Every low-score '/z-bad*' route must appear before every high-score '/a-good*'
    // route, even though 'a' sorts before 'z' alphabetically — this is the assertion
    // that would fail if verbose reverted to alphabetical order.
    const worstBadIndex = Math.max(...badRoutes.map((r) => byRouteSection.indexOf(r.route!)));
    const bestGoodIndex = Math.min(...goodRoutes.map((r) => byRouteSection.indexOf(r.route!)));
    expect(worstBadIndex).toBeLessThan(bestGoodIndex);
  });
  it('adds a Performance score section when performance findings exist', () => {
    const withPerf: Result[] = [
      ...results,
      {
        id: 'performance/image-dimensions',
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
    expect(out).toContain('performance/image-dimensions');
    expect(out).toContain('src/routes/blog/+page.svelte:42');
  });

  it('adds a Correctness score section when correctness findings exist', () => {
    const withCorrect: Result[] = [
      ...results,
      {
        id: 'correctness/each-key',
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
    expect(out).toContain('correctness/each-key');
  });

  it('collapses a rule that fires on multiple routes into one group with an "…and N more" line', () => {
    const multi: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'Missing <title>'
      },
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/b',
        message: 'Missing <title>'
      },
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/c',
        message: 'Missing <title>'
      }
    ];
    const out = formatConsoleReport(multi, config);
    expect(out).toContain('Critical (3)');
    // Only the first route's line is shown by default, plus a collapse line — not all three routes.
    expect(out).toContain('✗ seo/title-presence  Missing <title>');
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

  it("verbose:true restores today's full per-result listing, uncapped and ungrouped", () => {
    const multi: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/a',
        message: 'Missing <title>'
      },
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'none', value: 'absent' },
        route: '/b',
        message: 'Missing <title>'
      }
    ];
    const out = formatConsoleReport(multi, config, { verbose: true });
    expect(out).toContain('/a');
    expect(out).toContain('/b');
    expect(out).not.toContain('…and');
  });

  it('collapses the Passed section to a bare count by default (no per-item lines)', () => {
    const passing: Result[] = [
      {
        id: 'seo/canonical-url',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        route: '/a',
        message: 'Has <title>'
      },
      {
        id: 'seo/og-image',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        route: '/b',
        message: 'Has <meta description>'
      }
    ];
    const out = formatConsoleReport(passing, config);
    expect(out).toContain('Passed (2)');
    expect(out).not.toContain('✓ seo/canonical-url');
    expect(out).not.toContain('✓ seo/og-image');
  });

  it('lists every passed item under verbose:true, exactly as before', () => {
    const passing: Result[] = [
      {
        id: 'seo/canonical-url',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        route: '/a',
        message: 'Has <title>'
      }
    ];
    const out = formatConsoleReport(passing, config, { verbose: true });
    expect(out).toContain('✓ seo/canonical-url  Has <title>');
  });

  it('names a route-less passed result by its location (e.g. architecture/unit-entry-file passes)', () => {
    const passing: Result[] = [
      {
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'own', value: 'static' },
        location: 'src/lib/api/api.ts',
        message: 'Unit entry file'
      }
    ];
    const out = formatConsoleReport(passing, config, { verbose: true });
    // Without the fix every route-less pass renders an identical, path-less line — this
    // pins that the entry file itself shows up, not just a bare count.
    expect(out).toContain('✓ architecture/unit-entry-file  Unit entry file  src/lib/api/api.ts');
  });

  it('omits the "↯ = set dynamically" footnote in compact mode, since the ↯ marker itself only prints under verbose:true', () => {
    const dynamicPass: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'own', value: 'dynamic' },
        route: '/a',
        message: '<title>'
      }
    ];
    const compact = formatConsoleReport(dynamicPass, config);
    expect(compact).not.toContain('↯');

    const verbose = formatConsoleReport(dynamicPass, config, { verbose: true });
    expect(verbose).toContain('↯ dynamic');
    expect(verbose).toContain('↯ = set dynamically (verified at runtime).');
  });

  it('omitHeader:true skips the brand/Health lines but still prints category score lines', () => {
    const out = formatConsoleReport(results, config, { omitHeader: true });
    expect(out).not.toContain('Svelte Vitals');
    expect(out).not.toContain('Health:');
    expect(out).toContain('SEO Score:');
    expect(out).toContain('Critical (1)'); // body content still present
  });

  it('omitHeader is false by default — header still prints', () => {
    const out = formatConsoleReport(results, config);
    expect(out).toContain('Svelte Vitals');
    expect(out).toContain('Health:');
  });
});
