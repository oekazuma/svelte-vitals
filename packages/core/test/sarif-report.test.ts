import { describe, it, expect } from 'vitest';
import { formatSarifReport, defineConfig, type Result } from '../src/index.js';

const config = defineConfig({});

const results: Result[] = [
  {
    id: 'SEO001',
    severity: 'critical',
    detection: { presence: 'none', value: 'absent' },
    route: '/none',
    location: 'src/routes/none/+page.svelte',
    message: 'Missing <title>',
    recommendation: 'Add a <title>.',
    docsUrl: 'https://svelte-vitals.dev/rules/SEO001'
  },
  // project-scoped: no location, no route
  {
    id: 'SEO006',
    severity: 'warning',
    detection: { presence: 'none', value: 'absent' },
    message: 'Missing robots.txt'
  },
  // passing finding → must be excluded
  {
    id: 'SEO002',
    severity: 'critical',
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
    expect(run.results.map((r: { ruleId: string }) => r.ruleId)).toEqual(['SEO001', 'SEO006']);
  });

  it('maps severity to SARIF level', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    expect(run.results[0].level).toBe('error');
    expect(run.results[1].level).toBe('warning');
  });

  it('builds a deduplicated rules table that ruleIndex points into', () => {
    const run = JSON.parse(formatSarifReport(results, config, { version: '0.0.0' })).runs[0];
    const r0 = run.results[0];
    expect(run.tool.driver.rules[r0.ruleIndex].id).toBe('SEO001');
    const seo001 = run.tool.driver.rules.find((x: { id: string }) => x.id === 'SEO001');
    expect(seo001.name).toBe('Title presence');
    expect(seo001.shortDescription.text).toBe('Title presence');
    expect(seo001.helpUri).toBe('https://svelte-vitals.dev/rules/SEO001');
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
    expect(run.results[0].partialFingerprints['svelteVitals/v1']).toBe('SEO001:/none');
    expect(run.results[1].partialFingerprints['svelteVitals/v1']).toBe('SEO006:project');
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
        id: 'SEO001',
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
