import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createCountingRuntime } from './helpers/counting-runtime.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

// The memory runtime globs from its root, so the app sits there and the repository two levels up.
const APP_HTML = { 'src/app.html': `<!doctype html><html lang="en"><body></body></html>` };
const json = (value: Record<string, unknown>) => JSON.stringify(value);
const app = (deps: Record<string, string>) => ({ 'package.json': json({ name: 'web', dependencies: deps }) });

async function collect(files: Record<string, string>) {
  return collectAll(createMemoryRuntime({ ...APP_HTML, ...files }), '', defaultConfig);
}
const titles = (facts: Awaited<ReturnType<typeof collect>>, route = '/') =>
  facts.heads
    .find((h) => h.route === route)!
    .tags.filter((t) => t.kind === 'title')
    .map((t) => t.text ?? t.value);
const h1Files = (facts: Awaited<ReturnType<typeof collect>>, route = '/') =>
  facts.headings
    .find((h) => h.route === route)!
    .componentHeadings?.filter((h) => h.level === 1)
    .map((h) => h.file);

const PNPM_UI = {
  '../../.git': '',
  '../../pnpm-workspace.yaml': `packages:\n  - 'apps/*'\n  - 'packages/*'\n`,
  '../../packages/ui/package.json': json({
    name: '@repo/ui',
    exports: { '.': { types: './index.ts', svelte: './index.ts' }, './components/*': './src/components/*' }
  }),
  '../../packages/ui/src/components/MetaTags.svelte': `<script>import Hero from '@repo/ui/components/Hero.svelte';</script>
<svelte:head><title>Site</title></svelte:head><Hero />`,
  '../../packages/ui/src/components/Hero.svelte': `<h1>Welcome</h1>`
};

describe('collectAll — workspace packages', () => {
  it('follows a pnpm workspace package through its exports wildcard, and its self-imports', async () => {
    const facts = await collect({
      ...PNPM_UI,
      ...app({ '@repo/ui': 'workspace:*' }),
      'src/routes/+page.svelte': `<script>import MetaTags from '@repo/ui/components/MetaTags.svelte';</script><MetaTags />`
    });

    expect(titles(facts)).toEqual(['Site']);
    expect(h1Files(facts)).toEqual(['../../packages/ui/src/components/Hero.svelte']);
  });

  it('follows exports that name an unbuilt dist/ into the src/ or src/lib/ it is built from', async () => {
    const repo = {
      '../../.git': '',
      '../../pnpm-workspace.yaml': `packages:\n  - 'apps/*'\n  - 'packages/*'\n`,
      '../../packages/seo/package.json': json({
        name: '@repo/seo',
        exports: { './SEO.svelte': { svelte: './dist/components/SEO.svelte' } }
      }),
      '../../packages/seo/src/components/SEO.svelte': `<svelte:head><title>From src</title></svelte:head>`,
      '../../packages/ui/package.json': json({
        name: '@repo/ui',
        svelte: './dist/index.js',
        exports: { '.': { svelte: './dist/index.js' } }
      }),
      '../../packages/ui/src/lib/index.ts': `export { default as Hero } from './Hero.svelte';`,
      '../../packages/ui/src/lib/Hero.svelte': `<h1>Welcome</h1>`,
      ...app({ '@repo/seo': 'workspace:*', '@repo/ui': 'workspace:*' }),
      'src/routes/+page.svelte': `<script>import SEO from '@repo/seo/SEO.svelte'; import { Hero } from '@repo/ui';</script><SEO /><Hero />`
    };
    const facts = await collect(repo);
    expect(titles(facts)).toEqual(['From src']);
    expect(h1Files(facts)).toEqual(['../../packages/ui/src/lib/Hero.svelte']);

    const built = await collect({
      ...repo,
      '../../packages/seo/dist/components/SEO.svelte': `<svelte:head><title>From dist</title></svelte:head>`
    });
    expect(titles(built)).toEqual(['From dist']);
  });

  it('follows a `./*` → `./src/lib/*.js` pattern to the `.ts` barrel it names, as Vite does', async () => {
    const facts = await collect({
      '../../.git': '',
      '../../pnpm-workspace.yaml': `packages:\n  - 'apps/*'\n  - 'packages/*'\n`,
      '../../packages/core/package.json': json({
        name: '@repo/core',
        exports: { './*': { types: './src/lib/*.d.ts', default: './src/lib/*.js' } }
      }),
      '../../packages/core/src/lib/client/ui.ts': `export { default as ActivityView } from '../components/ActivityView.svelte';`,
      '../../packages/core/src/lib/components/ActivityView.svelte': `<h1>Activity</h1>`,
      ...app({ '@repo/core': 'workspace:*' }),
      'src/routes/+page.svelte': `<script>import { ActivityView } from '@repo/core/client/ui';</script><ActivityView />`
    });

    expect(h1Files(facts)).toEqual(['../../packages/core/src/lib/components/ActivityView.svelte']);
  });

  it('follows a workspace component a layout mounts with import() on a client-rendered route', async () => {
    const facts = await collect({
      ...PNPM_UI,
      ...app({ '@repo/ui': 'workspace:*' }),
      'src/routes/+layout.svelte': `<script>
  import { onMount } from 'svelte';
  let { children } = $props();
  let MetaTags = $state(null);
  onMount(async () => {
    MetaTags = (await import('@repo/ui/components/MetaTags.svelte')).default;
  });
</script>
{#if MetaTags}<MetaTags />{/if}
{@render children()}`,
      'src/routes/spa/+page.svelte': `<p>spa</p>`,
      'src/routes/spa/+page.ts': `export const ssr = false;\n`
    });

    expect(facts.heads.find((h) => h.route === '/spa')!.tags.map((t) => [t.kind, t.value])).toEqual([
      ['title', 'dynamic']
    ]);
  });

  it.each([
    ['an array', ['packages/*']],
    ['{ packages }', { packages: ['packages/*'] }]
  ])(
    'follows a package found through package.json workspaces as %s, by its exports conditions',
    async (_, workspaces) => {
      const facts = await collect({
        '../../.git': '',
        '../../package.json': json({ name: 'root', workspaces }),
        '../../packages/ui/package.json': json({
          name: '@acme/ui',
          exports: { '.': { types: './index.d.ts', svelte: './src/index.ts', default: './dist/index.js' } }
        }),
        '../../packages/ui/src/index.ts': `export { default as Title } from './Title.svelte';\n`,
        '../../packages/ui/src/Title.svelte': `<svelte:head><title>Acme</title></svelte:head>`,
        ...app({ '@acme/ui': 'workspace:^' }),
        'src/routes/+page.svelte': `<script>import { Title } from '@acme/ui';</script><Title />`
      });

      expect(titles(facts)).toEqual(['Acme']);
    }
  );

  it('follows a kit.alias pointing into node_modules/<workspace package> to the package directory', async () => {
    const facts = await collect({
      '../../.git': '',
      '../../pnpm-workspace.yaml': `packages:\n  - apps/*\n  - packages/*\n`,
      '../../packages/ui/package.json': json({ name: '@cio/ui' }),
      '../../packages/ui/src/base/page/index.ts': `import Title from './page-title.svelte';\nexport { Title };\n`,
      '../../packages/ui/src/base/page/page-title.svelte': `<h1><slot /></h1>`,
      ...app({ '@cio/ui': 'workspace:*' }),
      'svelte.config.js': `import path from 'path';
export default { kit: { alias: {
  '@cio/ui': path.resolve('./node_modules/@cio/ui/src'),
  '@cio/ui/*': path.resolve('./node_modules/@cio/ui/src/*')
} } };`,
      'src/routes/+page.svelte': `<script>import * as Page from '@cio/ui/base/page';</script><Page.Title>Courses</Page.Title>`
    });

    expect(h1Files(facts)).toEqual(['../../packages/ui/src/base/page/page-title.svelte']);
  });

  it('does not follow a workspace package the app does not declare, or declares from the registry', async () => {
    const page = `<script>import MetaTags from '@repo/ui/components/MetaTags.svelte';</script><MetaTags />`;
    const variants: Record<string, string>[] = [{}, { '@repo/ui': '^1.0.0' }, { '@repo/other': 'workspace:*' }];
    for (const deps of variants) {
      const facts = await collect({ ...PNPM_UI, ...app(deps), 'src/routes/+page.svelte': page });
      expect(titles(facts)).toEqual([]);
    }
  });

  it('follows a link: path inside the repository and refuses one that leaves it', async () => {
    const files = {
      '../../.git': '',
      '../../packages/linked/package.json': json({ name: '@repo/linked' }),
      '../../packages/linked/Title.svelte': `<svelte:head><title>Linked</title></svelte:head>`,
      '../../../outside/package.json': json({ name: '@x/outside' }),
      '../../../outside/Title.svelte': `<svelte:head><title>Outside</title></svelte:head>`,
      ...app({ '@repo/linked': 'link:../../packages/linked', '@x/outside': 'file:../../../outside' }),
      'src/routes/a/+page.svelte': `<script>import T from '@repo/linked/Title.svelte';</script><T />`,
      'src/routes/b/+page.svelte': `<script>import T from '@x/outside/Title.svelte';</script><T />`
    };
    const facts = await collect(files);

    expect(titles(facts, '/a')).toEqual(['Linked']);
    expect(titles(facts, '/b')).toEqual([]);

    // Without a `.git` there is no repository to be inside, so no link: path is followed.
    const { '../../.git': _, ...noGit } = files;
    expect(titles(await collect(noGit), '/a')).toEqual([]);
  });

  it('still finds the workspace with no .git above the app, the search ending at its depth limit', async () => {
    const { '../../.git': _, ...noGit } = PNPM_UI;
    const facts = await collect({
      ...noGit,
      ...app({ '@repo/ui': 'workspace:*' }),
      'src/routes/+page.svelte': `<script>import MetaTags from '@repo/ui/components/MetaTags.svelte';</script><MetaTags />`
    });

    expect(titles(facts)).toEqual(['Site']);
  });

  it('costs an app that declares no local package no workspace lookups', async () => {
    const { rt, counts } = createCountingRuntime(
      createMemoryRuntime({ ...APP_HTML, ...PNPM_UI, ...app({ svelte: '^5.0.0' }), 'src/routes/+page.svelte': `<p />` })
    );
    await collectAll(rt, '', defaultConfig);

    // The `.git` walk and `node_modules` probes above the app are the installed-package lookup's.
    const touched = [...counts.exists.keys(), ...counts.readFile.keys()].filter(
      (p) => p.startsWith('..') && !p.endsWith('/.git') && !p.includes('/node_modules/')
    );
    expect(touched).toEqual([]);
    expect([...counts.glob.keys()].filter((p) => p.endsWith('/package.json'))).toEqual([]);
  });
});
