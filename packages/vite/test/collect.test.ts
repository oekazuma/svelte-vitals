import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveRouteFromHtmlPath, collectRenderedHeads } from '../src/providers/rendered/collect.js';

describe('deriveRouteFromHtmlPath', () => {
  it('maps prerendered file paths to routes', () => {
    expect(deriveRouteFromHtmlPath('index.html')).toBe('/');
    expect(deriveRouteFromHtmlPath('about.html')).toBe('/about');
    expect(deriveRouteFromHtmlPath('blog/index.html')).toBe('/blog');
    expect(deriveRouteFromHtmlPath('blog/hello.html')).toBe('/blog/hello');
  });
});

describe('collectRenderedHeads', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sv-collect-'));
    await mkdir(join(dir, 'blog'), { recursive: true });
    const doc = (t: string) => `<html lang="en"><head><title>${t}</title></head><body></body></html>`;
    await writeFile(join(dir, 'index.html'), doc('Home'));
    await writeFile(join(dir, 'blog', 'index.html'), doc('Blog'));
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  it('reads every .html into a ResolvedHead with source rendered', async () => {
    const { heads, htmlLang } = await collectRenderedHeads(dir);
    const byRoute = new Map(heads.map((h) => [h.route, h]));
    expect([...byRoute.keys()].sort()).toEqual(['/', '/blog']);
    expect(byRoute.get('/')!.source).toBe('rendered');
    expect(byRoute.get('/')!.tags).toContainEqual({ kind: 'title', presence: 'own', text: 'Home', value: 'static' });
    expect(htmlLang).toEqual({ presence: 'own', value: 'static' });
  });
});

describe('collectRenderedHeads — a11y', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sv-collect-a11y-'));
    await writeFile(
      join(dir, 'index.html'),
      '<html lang="en"><head><title>t</title></head><body>' +
        '<main></main><main></main><p id="dup"></p><span id="dup"></span>' +
        '<label for="ghost">Name</label>' +
        '</body></html>'
    );
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  it('builds one ResolvedA11y per route, fully resolved, with the prerendered path as file', async () => {
    const { a11y } = await collectRenderedHeads(dir);
    expect(a11y).toHaveLength(1);
    const route = a11y[0]!;
    expect(route.route).toBe('/');
    expect(route.fullyResolved).toBe(true);
    expect(route.landmarks.main).toHaveLength(2);
    expect(route.landmarks.main![0]).toEqual({ file: 'index.html', line: 0 });
    expect(route.ids.dup).toHaveLength(2);
    expect(route.idRefs).toContainEqual({ id: 'ghost', attr: 'for', file: 'index.html', line: 0 });
    // "ghost" has no id="ghost" anywhere, so it must not be a candidate.
    expect(route.idCandidates).not.toContain('ghost');
    expect(route.idCandidates).toEqual(expect.arrayContaining(['dup']));
  });
});
