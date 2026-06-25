import { describe, it, expect } from 'vitest';
import { renderDashboard } from '../src/ui/serve.js';
import { defineConfig, type Result } from '@svelte-vitals/core';

const config = defineConfig({});
const results: Result[] = [
  { id: 'SEO001', message: 'Missing <title>', category: 'seo', detection: { presence: 'none', value: 'absent' }, route: '/a', location: 'a/+page.svelte', severity: 'critical' } as Result
];

describe('renderDashboard', () => {
  const html = renderDashboard(results, config, { version: '9.9.9' });

  it('reuses buildHtmlDocument (full doc with the finding)', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('SEO001');
  });

  it('injects a live-update script before </body>', () => {
    expect(html).toContain('data-live');
    expect(html).toContain("EventSource('/__svelte-vitals/events')");
    // injected before the closing body tag
    expect(html.indexOf('data-live')).toBeLessThan(html.indexOf('</body>'));
  });

  it('renders an empty snapshot without throwing', () => {
    expect(() => renderDashboard([], config, { version: '0' })).not.toThrow();
  });
});
