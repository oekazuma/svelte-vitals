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
    expect((await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap).toBe(
      true
    );
  });
  it('false when static/robots.txt lacks a Sitemap: line', async () => {
    await writeFile(join(cwd, 'static/robots.txt'), 'User-agent: *\nAllow: /\n');
    expect((await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap).toBe(
      false
    );
  });
  it('undefined when there is no static robots.txt', async () => {
    expect(
      (await collectRenderedProject(cwd, { presence: 'none', value: 'absent' })).robotsReferencesSitemap
    ).toBeUndefined();
  });
});

describe('collectRenderedProject: kitPathsBase', () => {
  let cwd: string;
  const htmlLang = { presence: 'none', value: 'absent' } as const;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-base-vite-'));
  });
  afterEach(async () => rm(cwd, { recursive: true, force: true }));

  it('reads a literal base from svelte.config.js', async () => {
    await writeFile(join(cwd, 'svelte.config.js'), `export default { kit: { paths: { base: '/docs' } } };`);
    expect((await collectRenderedProject(cwd, htmlLang)).kitPathsBase).toEqual({
      value: '/docs',
      file: 'svelte.config.js'
    });
  });

  it('omits the fact when no config declares a base', async () => {
    await writeFile(join(cwd, 'svelte.config.js'), `export default { kit: {} };`);
    expect((await collectRenderedProject(cwd, htmlLang)).kitPathsBase).toBeUndefined();
  });

  it('picks up the sveltekit({ paths: { base } }) shape in vite.config.ts', async () => {
    await writeFile(
      join(cwd, 'vite.config.ts'),
      [
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `export default { plugins: [sveltekit({ paths: { base: '/from-vite' } })] };`
      ].join('\n')
    );
    expect((await collectRenderedProject(cwd, htmlLang)).kitPathsBase).toEqual({
      value: '/from-vite',
      file: 'vite.config.ts'
    });
  });

  it('prefers the vite.config plugin form when both config files are present', async () => {
    await writeFile(
      join(cwd, 'svelte.config.js'),
      `export default { kit: { paths: { base: '/from-svelte-config' } } };`
    );
    await writeFile(
      join(cwd, 'vite.config.ts'),
      [
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `export default { plugins: [sveltekit({ paths: { base: '/from-vite' } })] };`
      ].join('\n')
    );
    expect((await collectRenderedProject(cwd, htmlLang)).kitPathsBase).toEqual({
      value: '/from-vite',
      file: 'vite.config.ts'
    });
  });
});

describe('collectRenderedProject: kitAliases', () => {
  let cwd: string;
  const htmlLang = { presence: 'none', value: 'absent' } as const;
  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), 'sv-alias-vite-'));
  });
  afterEach(async () => rm(cwd, { recursive: true, force: true }));

  it('reads kit.alias and kit.files.lib from svelte.config.js, $lib first', async () => {
    await writeFile(
      join(cwd, 'svelte.config.js'),
      `export default { kit: { files: { lib: 'src/library' }, alias: { '$data': 'src/data' } } };`
    );
    expect((await collectRenderedProject(cwd, htmlLang)).kitAliases).toEqual([
      { find: '$lib', replacement: 'src/library', match: 'prefix' },
      { find: '$data', replacement: 'src/data', match: 'prefix' }
    ]);
  });

  it('defaults to the $lib-only list when svelte.config declares no alias', async () => {
    await writeFile(join(cwd, 'svelte.config.js'), `export default { kit: {} };`);
    expect((await collectRenderedProject(cwd, htmlLang)).kitAliases).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' }
    ]);
  });

  it('is absent when no config file exists at all', async () => {
    expect((await collectRenderedProject(cwd, htmlLang)).kitAliases).toBeUndefined();
  });

  it('ignores svelte.config aliases when vite.config carries a sveltekit(<config>) argument', async () => {
    await writeFile(join(cwd, 'svelte.config.js'), `export default { kit: { alias: { '$data': 'src/data' } } };`);
    await writeFile(
      join(cwd, 'vite.config.ts'),
      [
        `import { sveltekit } from '@sveltejs/kit/vite';`,
        `export default { plugins: [sveltekit({ paths: { base: '/from-vite' } })] };`
      ].join('\n')
    );
    // Kit says svelte.config is ignored once options are passed to the plugin — aliases
    // must follow that same precedence as kitPathsBase does, or they'd be read from a file
    // the bundler ignores.
    expect((await collectRenderedProject(cwd, htmlLang)).kitAliases).toBeUndefined();
  });

  it("leaves svelte.config's aliases in effect when vite.config's sveltekit() takes no argument", async () => {
    await writeFile(join(cwd, 'svelte.config.js'), `export default { kit: { alias: { '$data': 'src/data' } } };`);
    await writeFile(
      join(cwd, 'vite.config.ts'),
      [`import { sveltekit } from '@sveltejs/kit/vite';`, `export default { plugins: [sveltekit()] };`].join('\n')
    );
    expect((await collectRenderedProject(cwd, htmlLang)).kitAliases).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$data', replacement: 'src/data', match: 'prefix' }
    ]);
  });
});
