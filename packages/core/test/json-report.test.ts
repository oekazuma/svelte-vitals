import { describe, it, expect } from 'vitest';
import { formatJsonReport, defineConfig, type Result } from '../src/index.js';

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
    message: 'Missing description'
  },
  { id: 'SEO006', severity: 'warning', detection: { presence: 'none', value: 'absent' }, message: 'Missing robots.txt' }
];

describe('formatJsonReport', () => {
  it('emits the documented shape with only penalized findings', () => {
    const json = JSON.parse(formatJsonReport(results, config, { version: '0.1.0' }));
    expect(json.version).toBe('0.1.0');
    expect(typeof json.score).toBe('number');
    expect(json.scoreModel).toHaveProperty('routeAverage');
    expect(json.summary.critical).toBe(1);
    const routeA = json.routes.find((r: { route: string }) => r.route === '/a');
    expect(routeA.issues).toHaveLength(1); // only the missing description (SEO001 passed)
    expect(routeA.issues[0].id).toBe('SEO002');
    expect(routeA.issues[0].detection).toEqual({ presence: 'none', value: 'absent' });
    expect(json.siteIssues).toHaveLength(1);
    expect(json.siteIssues[0].id).toBe('SEO006');
  });
});
