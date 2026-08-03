import { describe, it, expect } from 'vitest';
import { buildJsonReport, formatJsonReport, computeHealth, defineConfig, type Result } from '../src/index.js';

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
    message: 'Missing description',
    docsUrl: 'https://oekazuma.github.io/svelte-vitals/rules/seo002'
  },
  {
    id: 'seo/robots-txt',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing robots.txt'
  }
];

describe('formatJsonReport', () => {
  it('exposes a per-category scores map and tags issues with category', () => {
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
    const json = JSON.parse(formatJsonReport(withPerf, config, { version: '0.1.0' }));
    expect(json.categories.seo.score).toBeTypeOf('number');
    expect(json.categories.performance.score).toBeTypeOf('number');
    const blog = json.routes.find((r: { route: string }) => r.route === '/blog');
    expect(blog.issues[0].category).toBe('performance');
    expect(blog.issues[0].line).toBe(42);
  });

  it('emits the documented shape with only penalized findings', () => {
    const json = JSON.parse(formatJsonReport(results, config, { version: '0.1.0' }));
    expect(json.version).toBe('0.1.0');
    expect(typeof json.score).toBe('number'); // score is now the combined Health
    expect(json.weights).toBeDefined();
    expect(json.scoreModel).toBeUndefined(); // top-level scoreModel removed
    expect(json.categories.seo.scoreModel).toHaveProperty('routeAverage');
    expect(json.summary.critical).toBe(1);
    const routeA = json.routes.find((r: { route: string }) => r.route === '/a');
    expect(routeA.issues).toHaveLength(1);
    expect(routeA.issues[0].id).toBe('seo/description-presence');
    expect(routeA.issues[0].detection).toEqual({ presence: 'none', value: 'absent' });
    expect(routeA.issues[0].docsUrl).toBe('https://oekazuma.github.io/svelte-vitals/rules/seo002');
    expect(json.siteIssues).toHaveLength(1);
    expect(json.siteIssues[0].id).toBe('seo/robots-txt');
  });

  it('top-level score equals the combined Health', () => {
    const report = buildJsonReport(results, config, { version: '9.9.9' });
    expect(report.score).toBe(computeHealth(results, config).health);
    expect(report.weights).toEqual(computeHealth(results, config).weights);
  });

  it('buildJsonReport returns the object formatJsonReport stringifies', () => {
    const report = buildJsonReport(results, config, { version: '9.9.9' });
    expect(report.version).toBe('9.9.9');
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('summary');
    expect(Array.isArray(report.routes)).toBe(true);
    expect(Array.isArray(report.siteIssues)).toBe(true);
    expect(formatJsonReport(results, config, { version: '9.9.9' })).toBe(JSON.stringify(report, null, 2));
  });
});

describe('buildJsonReport — per-rule evidence', () => {
  const passOnly: Result[] = [
    {
      id: 'architecture/unit-entry-file',
      category: 'architecture',
      severity: 'info',
      detection: { presence: 'own', value: 'static' },
      location: 'src/lib/Card/Card.svelte',
      message: 'Unit entry file',
      recommendation: 'r'
    }
  ];

  it('lists a selected rule that produced nothing, which is the whole point', () => {
    // Without this entry, "ran and found nothing" and "was never selected" look identical.
    const report = buildJsonReport([], config, { version: 'x' }, ['architecture/directory-naming']);
    expect(report.rules['architecture/directory-naming']).toEqual({ findings: 0, passed: 0 });
  });

  it('omits a rule that was not selected', () => {
    const report = buildJsonReport(passOnly, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(Object.hasOwn(report.rules, 'architecture/directory-naming')).toBe(false);
  });

  it('counts a passing result that appears nowhere in issues', () => {
    // `passed` is the field that cannot be derived: `issues` is filtered to penalized results.
    const report = buildJsonReport(passOnly, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(report.rules['architecture/unit-entry-file']).toEqual({ findings: 0, passed: 1 });
    expect(report.routes.flatMap((r) => r.issues)).toHaveLength(0);
    expect(report.siteIssues).toHaveLength(0);
  });

  it('counts findings and passes separately for one rule', () => {
    const mixed: Result[] = [
      ...passOnly,
      {
        id: 'architecture/unit-entry-file',
        category: 'architecture',
        severity: 'info',
        detection: { presence: 'none', value: 'absent' },
        route: 'src/lib/Box',
        location: 'src/lib/Box/index.ts',
        message: 'missing entry file',
        recommendation: 'r'
      }
    ];
    const report = buildJsonReport(mixed, config, { version: 'x' }, ['architecture/unit-entry-file']);
    expect(report.rules['architecture/unit-entry-file']).toEqual({ findings: 1, passed: 1 });
  });

  it('falls back to the rules that produced results when no list is given', () => {
    // Back-compat: an external caller on the three-argument form sees today's information.
    const report = buildJsonReport(passOnly, config, { version: 'x' });
    expect(report.rules).toEqual({ 'architecture/unit-entry-file': { findings: 0, passed: 1 } });
  });

  it('reaches the same shape through formatJsonReport', () => {
    const parsed = JSON.parse(formatJsonReport([], config, { version: 'x' }, ['seo/single-h1']));
    expect(parsed.rules).toEqual({ 'seo/single-h1': { findings: 0, passed: 0 } });
  });
});
