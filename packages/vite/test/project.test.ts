import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectRenderedProject } from '../src/providers/rendered/project.js';

describe('collectRenderedProject', () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sv-proj-'));
    await mkdir(join(dir, 'static'), { recursive: true });
    await writeFile(join(dir, 'static', 'robots.txt'), 'x');
    await mkdir(join(dir, 'src', 'routes', 'sitemap.xml'), { recursive: true });
    await writeFile(join(dir, 'src', 'routes', 'sitemap.xml', '+server.ts'), 'export function GET(){}');
  });
  afterAll(async () => rm(dir, { recursive: true, force: true }));

  it('detects robots (static) and sitemap (endpoint) from source; passes htmlLang through', async () => {
    const p = await collectRenderedProject(dir, { presence: 'own', value: 'static' });
    expect(p.hasRobotsTxt).toBe(true);
    expect(p.hasSitemap).toBe(true);
    expect(p.htmlLang).toEqual({ presence: 'own', value: 'static' });
  });

  it('reports missing robots/sitemap', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'sv-proj-empty-'));
    const p = await collectRenderedProject(empty, { presence: 'none', value: 'absent' });
    expect(p.hasRobotsTxt).toBe(false);
    expect(p.hasSitemap).toBe(false);
    await rm(empty, { recursive: true, force: true });
  });
});

describe('collectRenderedProject: robotsReferencesSitemap', () => {
  let cwd: string;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-robots-vite-'));
    await mkdir(join(cwd, 'static'), { recursive: true });
  });
  afterEach(async () => rm(cwd, { recursive: true, force: true }));

  it('true when static/robots.txt has a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://e.com/sitemap.xml\n');
    expect((await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap).toBe(true);
  });
  it('false when static/robots.txt lacks a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\n');
    expect((await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap).toBe(false);
  });
  it('undefined when there is no static robots.txt', async () => {
    expect((await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap).toBeUndefined();
  });
});
