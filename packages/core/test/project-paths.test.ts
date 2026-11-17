import { describe, it, expect } from 'vitest';
import { servesRootFile } from '../src/project-paths.js';

describe('servesRootFile', () => {
  it.each([
    ['src/routes/robots.txt/+server.ts', 'robots.txt', true],
    ['src/routes/robots.txt/+server.js', 'robots.txt', true],
    ['src/routes/(seo)/(meta)/robots.txt/+server.ts', 'robots.txt', true],
    ['src/routes/sitemap.xml/+server.ts', 'sitemap.xml', true],
    ['src/routes/sitemap[[page]].xml/+server.ts', 'sitemap.xml', true],
    ['src/routes/sitemap[page].xml/+server.ts', 'sitemap.xml', false],
    ['src/routes/sitemap[[page]]Xxml/+server.ts', 'sitemap.xml', false],
    ['src/routes/xsitemap[[page]].xml/+server.ts', 'sitemap.xml', false],
    ['src/routes/sitemap[[page]].xml.bak/+server.ts', 'sitemap.xml', false],
    ['src/routes/sitemap.xml/+server.ts', 'robots.txt', false],
    ['src/routes/blog/robots.txt/+server.ts', 'robots.txt', false],
    ['src/routes/(seo)x/robots.txt/+server.ts', 'robots.txt', false],
    ['src/routes/x(seo)/robots.txt/+server.ts', 'robots.txt', false],
    ['src/routes/()/robots.txt/+server.ts', 'robots.txt', false],
    ['src/routes/robots.txt/+page.ts', 'robots.txt', false],
    ['src/routes/robots.txt/+server.tsx', 'robots.txt', false],
    ['src/routes/robots.txt/x+server.ts', 'robots.txt', false],
    ['src/lib/robots.txt/+server.ts', 'robots.txt', false],
    ['app/routes/robots.txt/+server.ts', 'robots.txt', false],
    ['robots.txt/+server.ts', 'robots.txt', false]
  ] as const)('%s serves /%s: %s', (rel, file, expected) => {
    expect(servesRootFile(rel, file)).toBe(expected);
  });
});
