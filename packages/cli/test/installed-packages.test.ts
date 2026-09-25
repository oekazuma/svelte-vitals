import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createNodeRuntime } from '../src/runtime/node.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const APP_HTML = { 'src/app.html': `<!doctype html><html lang="en"><body></body></html>` };
const json = (value: Record<string, unknown>) => JSON.stringify(value);
const app = (devDependencies: Record<string, string>) => ({
  '.git': '',
  'package.json': json({ name: 'web', devDependencies })
});

async function collect(files: Record<string, string>, config = defaultConfig) {
  return collectAll(createMemoryRuntime({ ...APP_HTML, ...files }), '', config);
}
type Facts = Awaited<ReturnType<typeof collect>>;
const titles = (facts: Facts, route = '/') =>
  facts.heads
    .find((h) => h.route === route)!
    .tags.filter((t) => t.kind === 'title')
    .map((t) => t.text ?? t.value);
const h1Files = (facts: Facts, route = '/') =>
  facts.headings
    .find((h) => h.route === route)!
    .componentHeadings?.filter((h) => h.level === 1)
    .map((h) => h.file);

/** A published package's shape (as seo-kit ships it): `exports['.'].svelte` and a `svelte` field, both naming a JS barrel. */
const SEO_KIT = {
  'node_modules/seo-kit/package.json': json({
    name: 'seo-kit',
    svelte: './dist/index.js',
    exports: { '.': { types: './dist/index.d.ts', svelte: './dist/index.js' } }
  }),
  'node_modules/seo-kit/dist/index.js': `export { default as Head } from './components/head.svelte';\n`,
  'node_modules/seo-kit/dist/components/head.svelte': `<script>let { title } = $props();</script>
<svelte:head><title>{title}</title><meta name="description" content="Svead" /></svelte:head>`
};
const HEAD_PAGE = `<script>import { Head } from 'seo-kit';</script><Head title="Home" /><p>hi</p>`;

describe('collectAll — installed npm packages', () => {
  it('follows a component through the exports svelte condition and a barrel', async () => {
    const facts = await collect({ ...SEO_KIT, ...app({ 'seo-kit': '^0.0.16' }), 'src/routes/+page.svelte': HEAD_PAGE });

    const tags = facts.heads.find((h) => h.route === '/')!.tags;
    expect(tags.map((t) => [t.kind, t.kind === 'meta' ? t.name : undefined, t.value])).toEqual([
      ['title', undefined, 'dynamic'],
      ['meta', 'description', 'static']
    ]);
  });

  it('follows a package without exports through its svelte field, and its headings', async () => {
    const facts = await collect({
      ...app({ 'old-ui': 'catalog:' }),
      'node_modules/old-ui/package.json': json({ name: 'old-ui', svelte: 'src/index.js' }),
      'node_modules/old-ui/src/index.js': `export { default as Hero } from './Hero.svelte';\n`,
      'node_modules/old-ui/src/Hero.svelte': `<svelte:head><title>Old</title></svelte:head><h1>Welcome</h1>`,
      'src/routes/+page.svelte': `<script>import { Hero } from 'old-ui';</script><Hero />`
    });

    expect(titles(facts)).toEqual(['Old']);
    expect(h1Files(facts)).toEqual(['node_modules/old-ui/src/Hero.svelte']);
  });

  it('finds a package hoisted to the repository root, and not one above the repository', async () => {
    const files = {
      '../../.git': '',
      '../../node_modules/seo-kit/package.json': SEO_KIT['node_modules/seo-kit/package.json'],
      '../../node_modules/seo-kit/dist/index.js': SEO_KIT['node_modules/seo-kit/dist/index.js'],
      '../../node_modules/seo-kit/dist/components/head.svelte':
        SEO_KIT['node_modules/seo-kit/dist/components/head.svelte'],
      'package.json': json({ name: 'web', devDependencies: { 'seo-kit': '^0.0.16' } }),
      'src/routes/+page.svelte': HEAD_PAGE
    };
    expect(titles(await collect(files))).toEqual(['dynamic']);

    const { '../../.git': _, ...repoAtApp } = files;
    expect(titles(await collect({ ...repoAtApp, '.git': '' }))).toEqual([]);
  });

  it('does not follow an undeclared package, a local-protocol dependency, or a package with no Svelte marker', async () => {
    const plain = {
      'node_modules/seo-kit/package.json': json({ name: 'seo-kit', exports: { '.': './dist/index.js' } }),
      'node_modules/seo-kit/dist/index.js': SEO_KIT['node_modules/seo-kit/dist/index.js'],
      'node_modules/seo-kit/dist/components/head.svelte': SEO_KIT['node_modules/seo-kit/dist/components/head.svelte']
    };
    for (const files of [
      { ...SEO_KIT, ...app({}) },
      { ...SEO_KIT, ...app({ 'seo-kit': 'link:../seo-kit' }) },
      { ...plain, ...app({ 'seo-kit': '^1.0.0' }) }
    ]) {
      expect(titles(await collect({ ...files, 'src/routes/+page.svelte': HEAD_PAGE }))).toEqual([]);
    }
  });

  it('leaves a known library to its adapter even when the package is installed', async () => {
    const facts = await collect({
      ...app({ 'svelte-meta-tags': '^5.0.0' }),
      'node_modules/svelte-meta-tags/package.json': json({
        name: 'svelte-meta-tags',
        exports: { '.': { types: './dist/index.d.ts', svelte: './dist/index.js' } }
      }),
      'node_modules/svelte-meta-tags/dist/index.js': `export { default as MetaTags } from './MetaTags.svelte';\n`,
      'node_modules/svelte-meta-tags/dist/MetaTags.svelte': `<svelte:head><title>From the file</title></svelte:head>`,
      'src/routes/+page.svelte': `<script>import { MetaTags } from 'svelte-meta-tags';</script><MetaTags title="From the adapter" />`
    });

    expect(titles(facts)).toEqual(['From the adapter']);
  });

  it('keeps metaComponents as the fallback when a package file does not parse, without failing the run', async () => {
    const files = {
      ...SEO_KIT,
      'node_modules/seo-kit/dist/components/head.svelte': `<svelte:head><title>{</svelte:head>`,
      ...app({ 'seo-kit': '^0.0.16' }),
      'src/routes/+page.svelte': HEAD_PAGE
    };
    expect(titles(await collect(files))).toEqual([]);
    const facts = await collect(files, { ...defaultConfig, metaComponents: ['Head'] });
    expect(titles(facts)).toEqual(['dynamic']);
  });

  it('leaves the a11y composition and each-key lists on the app and its workspace packages', async () => {
    const facts = await collect({
      ...SEO_KIT,
      'node_modules/seo-kit/dist/index.js': `export { default as Head } from './components/head.svelte';\nexport const TABS = ['a', 'b'];\n`,
      ...app({ 'seo-kit': '^0.0.16' }),
      'src/routes/+page.svelte': `<script>import { Head, TABS } from 'seo-kit';</script><Head title="Home" />
{#each TABS as tab}<b>{tab}</b>{/each}`
    });

    expect(titles(facts)).toEqual(['dynamic']);
    expect(facts.a11y.find((a) => a.route === '/')!.fullyResolved).toBe(false);
    expect(facts.components.find((c) => c.file === 'src/routes/+page.svelte')!.eachBlocks).toHaveLength(1);
  });
});

describe('collectAll — installed npm packages on disk', () => {
  it('reads a package through pnpm’s node_modules symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sv-installed-'));
    try {
      const store = 'node_modules/.pnpm/seo-kit@0.0.16/node_modules/seo-kit';
      const files = {
        ...APP_HTML,
        ...app({ 'seo-kit': '^0.0.16' }),
        'src/routes/+page.svelte': HEAD_PAGE,
        ...Object.fromEntries(
          Object.entries(SEO_KIT).map(([path, source]) => [path.replace('node_modules/seo-kit', store), source])
        )
      };
      for (const [path, source] of Object.entries(files)) {
        await mkdir(dirname(join(root, path)), { recursive: true });
        await writeFile(join(root, path), source);
      }
      await symlink('.pnpm/seo-kit@0.0.16/node_modules/seo-kit', join(root, 'node_modules/seo-kit'));

      const facts = await collectAll(createNodeRuntime(), root, defaultConfig);

      expect(titles(facts)).toEqual(['dynamic']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
