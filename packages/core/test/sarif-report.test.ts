import { describe, it, expect } from 'vitest';
import { defineConfig, type Result } from '../src/index.js';
import { formatSarifReport } from '../src/internal.js';

const config = defineConfig({});

const results: Result[] = [
  {
    id: 'seo/title-presence',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/none',
    location: 'src/routes/none/+page.svelte',
    message: 'Missing <title>',
    recommendation: 'Add a <title>.',
    docsUrl: 'https://oekazuma.github.io/svelte-vitals/rules/seo001'
  },
  // project-scoped: no location, no route
  {
    id: 'seo/robots-txt',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing robots.txt'
  },
  // passing finding → must be excluded (severity 'warning', matching the real rule
  // post P2 severity-alignment — description-presence can no longer produce 'critical')
  {
    id: 'seo/description-presence',
    severity: 'warning',
    detection: { presence: 'own', value: 'static' },
    route: '/ok',
    location: 'src/routes/ok/+page.svelte',
    message: '<meta name="description">'
  }
];

describe('formatSarifReport', () => {
  it('emits a valid SARIF 2.1.0 envelope', () => {
    const sarif = JSON.parse(formatSarifReport(results, config, { version: '9.9.9' }));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toContain('sarif-2.1.0');
    expect(sarif.runs[0].tool.driver.name).toBe('svelte-vitals');
    expect(sarif.runs[0].tool.driver.version).toBe('9.9.9');
  });

  it('emits only penalized findings, in order', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results.map((r: { ruleId: string }) => r.ruleId)).toEqual(['seo/title-presence', 'seo/robots-txt']);
  });

  it('maps severity to SARIF level', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].level).toBe('error');
    expect(run.results[1].level).toBe('warning');
  });

  it('builds a deduplicated rules table that ruleIndex points into', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    const r0 = run.results[0];
    expect(run.tool.driver.rules[r0.ruleIndex].id).toBe('seo/title-presence');
    const seo001 = run.tool.driver.rules.find((x: { id: string }) => x.id === 'seo/title-presence');
    expect(seo001.name).toBe('Title presence');
    expect(seo001.shortDescription.text).toBe('Title presence');
    expect(seo001.helpUri).toBe('https://oekazuma.github.io/svelte-vitals/rules/seo001');
    expect(seo001.defaultConfiguration.level).toBe('error');
  });

  it('sets physicalLocation when location is present and omits locations otherwise', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('src/routes/none/+page.svelte');
    expect(run.results[1].locations).toBeUndefined();
  });

  it('sets message text and partial fingerprints', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].message.text).toBe('Missing <title> Add a <title>.');
    expect(run.results[0].partialFingerprints['svelteVitals/v1']).toBe('seo/title-presence:/none');
    expect(run.results[1].partialFingerprints['svelteVitals/v1']).toBe('seo/robots-txt:project');
  });

  it('URI-encodes artifactLocation.uri, keeping separators and `+` intact', () => {
    const tricky: Result[] = [
      { ...results[0]!, location: 'src/routes/a b/[slug]/#tag/q?x/100%/ページ/+page.svelte', line: 12 }
    ];
    const run = JSON.parse(formatSarifReport(tricky, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
      'src/routes/a%20b/%5Bslug%5D/%23tag/q%3Fx/100%25/%E3%83%9A%E3%83%BC%E3%82%B8/+page.svelte'
    );
    expect(run.results[0].locations[0].physicalLocation.region.startLine).toBe(12);
    // The fingerprint keeps the raw path: changing its format would reset alert identity on GitHub.
    expect(run.results[0].partialFingerprints['svelteVitals/v1']).toBe(
      'seo/title-presence:/none:src/routes/a b/[slug]/#tag/q?x/100%/ページ/+page.svelte:12'
    );
  });

  it('uses result.line as startLine when present', () => {
    const withLine: Result[] = [
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
    const run = JSON.parse(formatSarifReport(withLine, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].locations[0].physicalLocation.region.startLine).toBe(42);
  });

  it('produces distinct partialFingerprints for same (id, route) but different line', () => {
    const twoImages: Result[] = [
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        line: 10,
        message: 'Missing <img> width/height at line 10'
      },
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        line: 20,
        message: 'Missing <img> width/height at line 20'
      }
    ];
    const run = JSON.parse(formatSarifReport(twoImages, config, { version: '0.0.0' })).runs[0];
    const fp0 = run.results[0].partialFingerprints['svelteVitals/v1'];
    const fp1 = run.results[1].partialFingerprints['svelteVitals/v1'];
    expect(fp0).toBe('performance/image-dimensions:/blog:src/routes/blog/+page.svelte:10');
    expect(fp1).toBe('performance/image-dimensions:/blog:src/routes/blog/+page.svelte:20');
    expect(fp0).not.toBe(fp1);
  });

  it('produces distinct partialFingerprints for same (id, route, line) but different location (file)', () => {
    const sameLineDiffFile: Result[] = [
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/+page.svelte',
        line: 5,
        message: 'Missing <img> width/height in page'
      },
      {
        id: 'performance/image-dimensions',
        category: 'performance',
        severity: 'warning',
        detection: { presence: 'none', value: 'absent' },
        route: '/blog',
        location: 'src/routes/blog/Card.svelte',
        line: 5,
        message: 'Missing <img> width/height in card'
      }
    ];
    const run = JSON.parse(formatSarifReport(sameLineDiffFile, config, { version: '0.0.0' })).runs[0];
    const fp0 = run.results[0].partialFingerprints['svelteVitals/v1'];
    const fp1 = run.results[1].partialFingerprints['svelteVitals/v1'];
    expect(fp0).toBe('performance/image-dimensions:/blog:src/routes/blog/+page.svelte:5');
    expect(fp1).toBe('performance/image-dimensions:/blog:src/routes/blog/Card.svelte:5');
    expect(fp0).not.toBe(fp1);
  });

  it('SEO fingerprints (no line) are unchanged by the location-in-fingerprint change', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].partialFingerprints['svelteVitals/v1']).toBe('seo/title-presence:/none');
    expect(run.results[1].partialFingerprints['svelteVitals/v1']).toBe('seo/robots-txt:project');
  });

  it('emits a valid empty log when there are no penalized findings', () => {
    const passing: Result[] = [results[2]!];
    const sarif = JSON.parse(formatSarifReport(passing, config, { version: '0.0.0' }));
    expect(sarif.runs[0].results).toEqual([]);
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
  });

  it('emits a dynamic finding only when treatDynamicAs penalizes it', () => {
    const dyn: Result[] = [
      {
        id: 'seo/title-presence',
        severity: 'critical',
        detection: { presence: 'own', value: 'dynamic' },
        route: '/d',
        location: 'src/routes/d/+page.svelte',
        message: '<title>'
      }
    ];
    expect(JSON.parse(formatSarifReport(dyn, config, { version: '0' })).runs[0].results).toEqual([]);
    const warned = JSON.parse(formatSarifReport(dyn, defineConfig({ treatDynamicAs: 'warn' }), { version: '0' }));
    expect(warned.runs[0].results[0].level).toBe('warning'); // effectiveSeverity → warning
  });
});
