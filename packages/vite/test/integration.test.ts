import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { svelteVitals } from '../src/index.js';

describe('svelteVitals plugin', () => {
  let cwd: string;
  beforeAll(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-int-'));
    const pages = join(cwd, '.svelte-kit/output/prerendered/pages');
    await mkdir(pages, { recursive: true });
    await writeFile(join(pages, 'index.html'), `<html lang="en"><head><title>Home</title></head><body></body></html>`);
  });
  afterAll(async () => rm(cwd, { recursive: true, force: true }));

  it('is a build-only plugin named svelte-vitals', () => {
    const p = svelteVitals({ cwd }) as Plugin;
    expect(p.name).toBe('svelte-vitals');
    expect(p.apply).toBe('build');
  });

  it('throws to fail the build when a critical finding exists (missing description on /)', async () => {
    const p = svelteVitals({ cwd, report: false, failOn: 'critical' }) as Plugin;
    // closeBundle is a function on the plugin object
    const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
    await expect((hook as () => Promise<void>).call({})).rejects.toThrow(/svelte-vitals: build failed/);
  });

  it('does not throw when all critical rules pass (fully-populated page)', async () => {
    // Build a second fixture cwd whose only prerendered page satisfies every rule.
    const cleanCwd = await mkdtemp(join(tmpdir(), 'sv-int-clean-'));
    try {
      const cleanPages = join(cleanCwd, '.svelte-kit/output/prerendered/pages');
      await mkdir(cleanPages, { recursive: true });
      // static/ files for robots/sitemap project rules
      await mkdir(join(cleanCwd, 'static'), { recursive: true });
      await writeFile(join(cleanCwd, 'static/robots.txt'), 'User-agent: *\nAllow: /');
      await writeFile(
        join(cleanCwd, 'static/sitemap.xml'),
        '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
      );
      // Fully-populated page: title, description, canonical, og:title, og:image, JSON-LD, html lang
      await writeFile(
        join(cleanPages, 'index.html'),
        [
          '<html lang="en">',
          '<head>',
          '<title>Clean Page</title>',
          '<meta name="description" content="A fully SEO-optimised page for integration testing.">',
          '<link rel="canonical" href="https://example.com/">',
          '<meta property="og:title" content="Clean Page">',
          '<meta property="og:image" content="https://example.com/og.png">',
          '<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Clean Page"}</script>',
          '</head>',
          '<body></body>',
          '</html>'
        ].join('')
      );
      const p = svelteVitals({ cwd: cleanCwd, report: false, failOn: 'critical' }) as Plugin;
      const hook = typeof p.closeBundle === 'function' ? p.closeBundle : p.closeBundle?.handler;
      await expect((hook as () => Promise<void>).call({})).resolves.toBeUndefined();
    } finally {
      await rm(cleanCwd, { recursive: true, force: true });
    }
  });
});
