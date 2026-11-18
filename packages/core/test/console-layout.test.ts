import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { formatConsoleReport } from '../src/internal.js';

const RULE = '─'.repeat(24);
const config = defineConfig({});
const fail = (id: string, route: string | undefined, extra: Partial<Result> = {}): Result => ({
  id,
  severity: 'warning',
  detection: { presence: 'none', value: 'absent' },
  message: `${id} failed`,
  ...(route !== undefined ? { route, location: `src/routes${route}/+page.svelte` } : {}),
  ...extra
});
const pass = (route: string): Result => ({
  id: 'seo/lang',
  severity: 'warning',
  detection: { presence: 'own', value: 'static' },
  message: 'ok',
  route
});

const routes = Array.from({ length: 11 }, (_, i) => `/r${String(i).padStart(2, '0')}`);
const core: Result[] = [
  fail('seo/f-rule', routes[6]),
  fail('seo/b-rule', '/r00', { line: 7 }),
  fail('seo/b-rule', '/r01'),
  ...['seo/a-rule', 'seo/c-rule', 'seo/d-rule', 'seo/e-rule'].map((id, i) => fail(id, routes[i + 2])),
  fail('seo/title-presence', '/r07', { severity: 'critical' }),
  fail('seo/robots-txt', undefined)
];
const infos = ['a', 'b', 'c', 'd', 'e', 'f'].map((x) => fail(`seo/info-${x}`, '/r08', { severity: 'info' }));

describe('console report layout', () => {
  it('groups failures by rule and severity, counts passes, and caps the route tree', () => {
    const out = formatConsoleReport([...core, ...infos, ...routes.map(pass)], config, { byRoute: true });
    expect(out).toBe(
      [
        'Svelte Vitals  ·  static mode',
        '',
        'Health: 78/100',
        'SEO Score: 78/100   (route avg 83 · site −5)',
        '',
        'Critical (1)',
        RULE,
        '✗ seo/title-presence  seo/title-presence failed',
        '            /r07',
        '            src/routes/r07/+page.svelte',
        '',
        'Warnings (8)',
        RULE,
        '✗ seo/b-rule  seo/b-rule failed',
        '            /r00',
        '            src/routes/r00/+page.svelte:7',
        '            …and 1 more',
        '✗ seo/a-rule  seo/a-rule failed',
        '            /r02',
        '            src/routes/r02/+page.svelte',
        '✗ seo/c-rule  seo/c-rule failed',
        '            /r03',
        '            src/routes/r03/+page.svelte',
        '✗ seo/d-rule  seo/d-rule failed',
        '            /r04',
        '            src/routes/r04/+page.svelte',
        '✗ seo/e-rule  seo/e-rule failed',
        '            /r05',
        '            src/routes/r05/+page.svelte',
        '…and 2 more rules affected — run with --verbose to see all',
        '',
        'Info (6)',
        RULE,
        '✗ seo/info-a  seo/info-a failed',
        '            /r08',
        '            src/routes/r08/+page.svelte',
        '✗ seo/info-b  seo/info-b failed',
        '            /r08',
        '            src/routes/r08/+page.svelte',
        '✗ seo/info-c  seo/info-c failed',
        '            /r08',
        '            src/routes/r08/+page.svelte',
        '✗ seo/info-d  seo/info-d failed',
        '            /r08',
        '            src/routes/r08/+page.svelte',
        '✗ seo/info-e  seo/info-e failed',
        '            /r08',
        '            src/routes/r08/+page.svelte',
        '…and 1 more rule affected — run with --verbose to see all',
        '',
        'Passed (11)',
        RULE,
        '',
        'By route',
        RULE,
        '/r08                         76',
        '    ✗ seo/info-a  seo/info-a failed',
        '    ✗ seo/info-b  seo/info-b failed',
        '    ✗ seo/info-c  seo/info-c failed',
        '    ✗ seo/info-d  seo/info-d failed',
        '    ✗ seo/info-e  seo/info-e failed',
        '    ✗ seo/info-f  seo/info-f failed',
        '/r00                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        '/r01                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        '/r02                         80',
        '    ✗ seo/a-rule  seo/a-rule failed',
        '/r03                         80',
        '    ✗ seo/c-rule  seo/c-rule failed',
        '/r04                         80',
        '    ✗ seo/d-rule  seo/d-rule failed',
        '/r05                         80',
        '    ✗ seo/e-rule  seo/e-rule failed',
        '/r06                         80',
        '    ✗ seo/f-rule  seo/f-rule failed',
        '/r07                         85',
        '    ✗ seo/title-presence  seo/title-presence failed',
        '/r09                         100',
        '…and 1 more route (avg score 100) — run with --verbose to see all',
        ''
      ].join('\n')
    );
  });

  it('names the site penalty and the critical cap in the score line', () => {
    const out = formatConsoleReport([...core, ...routes.map(pass)], config, { byRoute: true });
    expect(out.split('\n')[3]).toBe('SEO Score: 79/100   (route avg 85 · site −5 · capped at 79: critical present)');
  });

  it('lists every route under verbose', () => {
    const out = formatConsoleReport([...core, ...routes.map(pass)], config, { byRoute: true, verbose: true });
    const listed = out
      .split('\n')
      .filter((l) => /^\/r\d\d /.test(l))
      .map((l) => l.split(' ')[0])
      .sort();
    expect([listed, out.includes('more route')]).toEqual([routes, false]);
  });

  it('counts hidden routes and rules only past the cap', () => {
    const ten = [...core, ...routes.slice(0, 10).map(pass)];
    expect(formatConsoleReport(ten, config, { byRoute: true })).not.toContain('more route');
    const twelve = [...core, ...routes.map(pass), pass('/r11')];
    expect(formatConsoleReport(twelve, config, { byRoute: true })).toContain('…and 2 more routes (avg score 100)');
    const thirteen = [
      ...routes.map((r) => fail('seo/i', r, { severity: 'info' })),
      ...['/r11', '/r12', ...routes].map(pass)
    ];
    expect(formatConsoleReport(thirteen, config, { byRoute: true })).toContain('…and 3 more routes (avg score 98)');
    const fiveRules = ['a', 'b', 'c', 'd', 'e'].map((x) => fail(`seo/${x}`, '/r00'));
    expect(formatConsoleReport(fiveRules, config)).not.toContain('more rule');
  });

  it('collapses trailing newlines to one', () => {
    const out = formatConsoleReport(
      [{ id: 'seo/x', severity: 'warning', detection: { presence: 'own', value: 'static' }, message: 'ok\n' }],
      config,
      { verbose: true }
    );
    expect([out.endsWith('ok\n'), out.endsWith('\n\n')]).toEqual([true, false]);
  });

  it('lists every result, dynamic passes and the dynamic footnote under verbose', () => {
    const dynamic: Result = {
      id: 'seo/og',
      severity: 'warning',
      detection: { presence: 'own', value: 'dynamic' },
      message: 'og set',
      route: '/r00'
    };
    const input: Result[] = [
      fail('seo/b-rule', '/r00', { line: 7 }),
      fail('seo/b-rule', '/r01'),
      dynamic,
      { id: 'seo/sitemap', severity: 'warning', detection: { presence: 'own', value: 'static' }, message: 'ok' }
    ];
    const dynamicPass = defineConfig({ treatDynamicAs: 'pass' });
    const out = formatConsoleReport(input, dynamicPass, { verbose: true, byRoute: true, mode: 'build mode' });
    expect(formatConsoleReport(input, dynamicPass, { byRoute: true, mode: 'build mode' })).toBe(
      [
        'Svelte Vitals  ·  build mode',
        '',
        'Health: 80/100',
        'SEO Score: 80/100   (route avg 80)',
        '',
        'Warnings (2)',
        RULE,
        '✗ seo/b-rule  seo/b-rule failed',
        '            /r00',
        '            src/routes/r00/+page.svelte:7',
        '            …and 1 more',
        '',
        'Passed (2)',
        RULE,
        '',
        'By route',
        RULE,
        '/r00                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        '/r01                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        ''
      ].join('\n')
    );
    expect(out).toBe(
      [
        'Svelte Vitals  ·  build mode',
        '',
        'Health: 80/100',
        'SEO Score: 80/100   (route avg 80)',
        '',
        'Warnings (2)',
        RULE,
        '✗ seo/b-rule  seo/b-rule failed',
        '            /r00',
        '            src/routes/r00/+page.svelte:7',
        '✗ seo/b-rule  seo/b-rule failed',
        '            /r01',
        '            src/routes/r01/+page.svelte',
        '',
        'Passed (2)',
        RULE,
        '✓ seo/og  og set  ↯ dynamic  /r00',
        '✓ seo/sitemap  ok',
        '',
        'By route',
        RULE,
        '/r00                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        '/r01                         80',
        '    ✗ seo/b-rule  seo/b-rule failed',
        '',
        '↯ = set dynamically (verified at runtime).'
      ].join('\n')
    );
  });

  it('prints no Passed section and no footnote when nothing passed', () => {
    expect(formatConsoleReport([fail('seo/robots-txt', undefined)], config, { verbose: true })).toBe(
      [
        'Svelte Vitals  ·  static mode',
        '',
        'Health: 95/100',
        'SEO Score: 95/100   (route avg 100 · site −5)',
        '',
        'Warnings (1)',
        RULE,
        '✗ seo/robots-txt  seo/robots-txt failed',
        ''
      ].join('\n')
    );
  });
});
