import { describe, it, expect } from 'vitest';
import { collectProjectFacts } from '../src/providers/source/project.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('collectProjectFacts', () => {
  it('detects static robots.txt and sitemap.xml', async () => {
    const rt = createMemoryRuntime({ 'static/robots.txt': 'x', 'static/sitemap.xml': '<urlset/>' });
    const p = await collectProjectFacts(rt, '');
    expect(p.hasRobotsTxt).toBe(true);
    expect(p.hasSitemap).toBe(true);
  });
  it('detects endpoint-based robots and sitemap', async () => {
    const rt = createMemoryRuntime({
      'src/routes/robots.txt/+server.ts': 'export function GET(){}',
      'src/routes/sitemap.xml/+server.js': 'export function GET(){}'
    });
    const p = await collectProjectFacts(rt, '');
    expect(p.hasRobotsTxt).toBe(true);
    expect(p.hasSitemap).toBe(true);
  });
  it('parses <html lang> from app.html', async () => {
    const present = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang="en">' }), '');
    expect(present.htmlLang).toEqual({ presence: 'own', value: 'static' });
    const empty = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html lang="">' }), '');
    expect(empty.htmlLang).toEqual({ presence: 'own', value: 'absent' });
    const none = await collectProjectFacts(createMemoryRuntime({ 'src/app.html': '<html>' }), '');
    expect(none.htmlLang).toEqual({ presence: 'none', value: 'absent' });
  });
});
