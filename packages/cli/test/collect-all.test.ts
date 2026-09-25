import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core/internal';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const PROJECT = {
  'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
  'src/routes/+layout.svelte': `<script>let { children } = $props();</script>{@render children()}`,
  'src/routes/a/+page.svelte': `<svelte:head><title>A</title></svelte:head><h1>A</h1>`,
  'src/routes/b/+page.svelte': `<svelte:head><title>B</title></svelte:head><h1>B</h1>`,
  'src/lib/Card.svelte': `<script>let { title = '' } = $props();</script><h3>{title}</h3>`,
  'src/hooks.server.ts': `export async function handle({ event, resolve }) {\n  return resolve(event);\n}\n`,
  'src/routes/a/+page.server.ts': `export async function load() {\n  return {};\n}\n`
};

describe('collectAll', () => {
  it('returns facts for every route plus project-wide and component facts', async () => {
    const rt = createMemoryRuntime(PROJECT);

    const facts = await collectAll(rt, '', defaultConfig);

    expect(facts.heads.map((h) => h.route).sort()).toEqual(['/a', '/b']);
    expect(facts.images.map((i) => i.route).sort()).toEqual(['/a', '/b']);
    expect(facts.headings.map((h) => h.route).sort()).toEqual(['/a', '/b']);
    expect(facts.project.htmlLang).toEqual({ presence: 'own', value: 'static' });
    // Every .svelte under src/ is scanned, routes and $lib alike.
    expect(facts.components.map((c) => c.file).sort()).toEqual([
      'src/lib/Card.svelte',
      'src/routes/+layout.svelte',
      'src/routes/a/+page.svelte',
      'src/routes/b/+page.svelte'
    ]);
    // Non-empty on purpose: an empty-fixture assertion here would pass identically
    // if the collectKitModuleFacts call were deleted from collectAll outright.
    expect(facts.kitModules.map((m) => m.file).sort()).toEqual(['src/hooks.server.ts', 'src/routes/a/+page.server.ts']);
    expect(facts.sourceFiles).toEqual([
      'src/app.html',
      'src/hooks.server.ts',
      'src/lib/Card.svelte',
      'src/routes/+layout.svelte',
      'src/routes/a/+page.server.ts',
      'src/routes/a/+page.svelte',
      'src/routes/b/+page.svelte'
    ]);
  });

  it('filters route-scoped facts and hands the rules no component/kit-module facts when route is set', async () => {
    const rt = createMemoryRuntime(PROJECT);

    const facts = await collectAll(rt, '', defaultConfig, { route: 'a' });

    expect(facts.heads.map((h) => h.route)).toEqual(['/a']);
    expect(facts.images.map((i) => i.route)).toEqual(['/a']);
    expect(facts.headings.map((h) => h.route)).toEqual(['/a']);
    // File-scoped facts have no route attribution, so a route-filtered run skips them.
    expect(facts.components).toEqual([]);
    expect(facts.kitModules).toEqual([]);
    // `undefined`, NOT `[]` — the distinction is load-bearing. An empty inventory tells
    // architecture/unit-entry-file that the declared unit directories really are absent,
    // so it reports every declaration as inert; `undefined` means the fact was never
    // collected and the rule stays silent. Pinned here as well as in
    // analyze-project.test.ts so a break points at collectAll rather than at the CLI.
    expect(facts.sourceFiles).toBeUndefined();
  });

  it('drops the route facts of a page whose load always redirects, keeping its file-scoped facts', async () => {
    const rt = createMemoryRuntime({
      ...PROJECT,
      'src/routes/(app)/old/+page.svelte': '',
      'src/routes/(app)/old/+page.ts': `import { redirect } from '@sveltejs/kit';\nexport function load() {\n  redirect(301, '/a');\n}\n`,
      'src/routes/+layout.ts': `import { redirect } from '@sveltejs/kit';\nexport function load() {\n  redirect(301, '/a');\n}\n`
    });

    const facts = await collectAll(rt, '', defaultConfig);

    for (const list of [facts.heads, facts.images, facts.headings, facts.a11y])
      expect(list.map((f) => f.route).sort()).toEqual(['/a', '/b']);
    expect(facts.components.map((c) => c.file)).toContain('src/routes/(app)/old/+page.svelte');
    expect(facts.emptySelections).toEqual([]);

    const scoped = await collectAll(rt, '', defaultConfig, { route: '/old' });
    expect(scoped.heads).toEqual([]);
    expect(scoped.kitModules).toEqual([]);
    expect(scoped.emptySelections).toEqual([]);
  });
});

describe('collectAll — kit aliases', () => {
  const TREE = {
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
    'svelte.config.js': `export default { kit: { alias: { '$data': 'src/data' } } };`,
    'src/routes/+page.svelte': `<h1>a</h1>`,
    'src/routes/+page.server.ts': `import { s } from '$data/store.svelte';\nexport function load() {\n  return {};\n}\n`
  };

  it('collects the alias list and resolves a kit-module import through it', async () => {
    const facts = await collectAll(createMemoryRuntime(TREE), '', defaultConfig);

    expect(facts.project.kitAliases).toEqual([
      { find: '$lib', replacement: 'src/lib', match: 'prefix' },
      { find: '$data', replacement: 'src/data', match: 'prefix' }
    ]);
    // The point of collecting it: the kit-module collector must have USED the list.
    expect(facts.kitModules[0]!.runesModuleImports.map((i) => i.resolved)).toEqual(['src/data/store.svelte.ts']);
  });

  it('leaves the fact absent when there is no svelte config', async () => {
    const { 'svelte.config.js': _omitted, ...rest } = TREE;
    const facts = await collectAll(createMemoryRuntime(rest), '', defaultConfig);

    expect(facts.project.kitAliases).toBeUndefined();
    expect(facts.kitModules[0]!.runesModuleImports).toEqual([]);
  });
});

describe('collectAll — a component loaded with import()', () => {
  const TREE = {
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
    'src/routes/+layout.svelte': `<script>
  import { onMount } from 'svelte';
  let { children } = $props();
  let Meta = $state(null);
  onMount(async () => {
    Meta = (await import('$lib/Meta.svelte')).default;
  });
</script>
{#if Meta}<Meta />{/if}
{@render children()}`,
    'src/lib/Meta.svelte': `<svelte:head><title>Site</title><link rel="canonical" href="https://x.test/" /></svelte:head><h1>Site</h1>`,
    'src/routes/spa/+page.svelte': `<p>spa</p>`,
    'src/routes/spa/+page.ts': `export const ssr = false;\n`,
    'src/routes/ssr/+page.svelte': `<p>ssr</p>`,
    'src/routes/own/+page.svelte': `<svelte:head><title>Own</title></svelte:head>`
  };
  const head = (facts: Awaited<ReturnType<typeof collectAll>>, route: string) =>
    facts.heads.find((h) => h.route === route)!.tags.map(({ kind, value, text }) => ({ kind, value, text }));

  it('credits its tags, as may-render, only on routes that are never server-rendered', async () => {
    const facts = await collectAll(createMemoryRuntime(TREE), '', defaultConfig);

    expect(head(facts, '/spa')).toEqual([
      { kind: 'title', value: 'dynamic', text: undefined },
      { kind: 'link', value: 'dynamic', text: undefined }
    ]);
    expect(head(facts, '/ssr')).toEqual([]);
    expect(head(facts, '/own')).toEqual([{ kind: 'title', value: 'static', text: 'Own' }]);
    const dynamicHeading = (route: string) => facts.headings.find((h) => h.route === route)!.dynamicHeading;
    expect(dynamicHeading('/spa')).toBe(true);
    expect(dynamicHeading('/ssr')).toBeUndefined();
  });

  it('keeps the server-rendered route free of them under --route too', async () => {
    const rt = createMemoryRuntime(TREE);
    const spa = await collectAll(rt, '', defaultConfig, { route: '/spa' });
    const ssr = await collectAll(rt, '', defaultConfig, { route: '/ssr' });

    expect(head(spa, '/spa').map((t) => t.kind)).toEqual(['title', 'link']);
    expect(head(ssr, '/ssr')).toEqual([]);
  });

  it('never lets a client-only tag hide a server-rendered one an outer layout sets', async () => {
    const facts = await collectAll(
      createMemoryRuntime({
        ...TREE,
        'src/routes/ssr/+layout.svelte': `<svelte:head><title>Server</title></svelte:head>{@render children()}`,
        'src/routes/ssr/+page.svelte': `<script>
  import { onMount } from 'svelte';
  let Meta = $state(null);
  onMount(async () => {
    const [meta] = await Promise.all([import('$lib/Meta.svelte')]);
    Meta = meta.default;
  });
</script>
<Meta />`
      }),
      '',
      defaultConfig
    );

    expect(head(facts, '/ssr')).toEqual([{ kind: 'title', value: 'static', text: 'Server' }]);
  });
});

describe('collectAll — a kit.alias above the project root', () => {
  const TREE = {
    // The memory runtime globs from its root, so the project sits there and the plugins above it.
    'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
    'svelte.config.js': `export default { kit: { alias: { $plugins: '../plugins' } } };`,
    'src/routes/shop/+page.svelte': `<script>import Landing from '$plugins/shop/Landing.svelte';</script><Landing />`,
    '../plugins/shop/Landing.svelte': `<script>import Hero from './Hero.svelte';</script><svelte:head><title>Shop</title></svelte:head><Hero />`,
    '../plugins/shop/Hero.svelte': `<h1>Shop</h1>`
  };

  it('follows components inside the directory the alias names', async () => {
    const facts = await collectAll(createMemoryRuntime(TREE), '', defaultConfig);

    expect(facts.heads[0]!.tags.map((t) => [t.kind, t.text, t.file])).toEqual([
      ['title', 'Shop', 'src/routes/shop/+page.svelte']
    ]);
    expect(facts.headings[0]!.componentHeadings?.map((h) => [h.level, h.file])).toEqual([
      [1, '../plugins/shop/Hero.svelte']
    ]);
  });
});

describe('collectAll: app.html head tags', () => {
  const APP_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>Shell title</title>
    <meta name="Twitter:card" content="summary" />
    <meta property="og:image" content="%sveltekit.assets%/og.png" />
    <link rel="icon" href="/favicon.png" />
    <link rel="canonical" href="https://example.test/" />
    %sveltekit.head%
  </head>
  <body>%sveltekit.body%</body>
</html>`;

  it("seeds every route with the shell's literal title, meta and canonical below any route tag", async () => {
    const rt = createMemoryRuntime({
      'src/app.html': APP_HTML,
      'src/routes/a/+page.svelte': `<h1>A</h1>`,
      'src/routes/b/+page.svelte': `<svelte:head><title>Own title</title></svelte:head><h1>B</h1>`,
      'src/routes/c/+page.svelte': `<script>import Seo from 'seo-pkg';</script><Seo /><h1>C</h1>`
    });

    const { heads } = await collectAll(rt, '', { ...defaultConfig, metaComponents: ['Seo'] });
    const tagsOf = (route: string) => heads.find((h) => h.route === route)!.tags;

    expect(tagsOf('/a')).toEqual([
      { kind: 'title', value: 'static', text: 'Shell title', presence: 'inherited', file: 'src/app.html' },
      { kind: 'meta', name: 'twitter:card', value: 'static', presence: 'inherited', file: 'src/app.html' },
      {
        kind: 'link',
        rel: 'canonical',
        value: 'static',
        href: 'https://example.test/',
        presence: 'inherited',
        file: 'src/app.html'
      }
    ]);
    expect(tagsOf('/b').find((t) => t.kind === 'title')).toMatchObject({ presence: 'own', text: 'Own title' });
    // An opaque meta component may set the title, so the shell's literal must not stand in for it.
    expect(tagsOf('/c').find((t) => t.kind === 'title')).toEqual({ kind: 'title', value: 'dynamic', presence: 'own' });
  });
  it('keeps every robots meta — the shell, layout and page ones all render', async () => {
    const rt = createMemoryRuntime({
      'src/app.html': APP_HTML.replace(
        '%sveltekit.head%',
        '<meta name="robots" content="noindex" />\n    %sveltekit.head%'
      ),
      'src/routes/+layout.svelte': `<svelte:head><meta name="robots" content="noindex" /></svelte:head><slot />`,
      'src/routes/a/+page.svelte': `<svelte:head><meta name="robots" content="index, follow" /></svelte:head><h1>A</h1>`
    });

    const { heads } = await collectAll(rt, '', defaultConfig);
    const robots = heads.find((h) => h.route === '/a')!.tags.filter((t) => t.kind === 'meta' && t.name === 'robots');
    expect(robots.map((t) => [t.file, t.noindex === true])).toEqual([
      ['src/routes/+layout.svelte', true],
      ['src/routes/a/+page.svelte', false],
      ['src/app.html', true]
    ]);
  });
});

describe('collectAll — {#each} over an imported constant list', () => {
  const each = (script: string, list = 'xs') =>
    `<script lang="ts">${script}</script>{#each ${list} as x}<b>{x}</b>{/each}`;
  const MODULES = {
    'src/lib/data.ts': `export const xs = ['a', 'b'];\nexport const typed = [{ id: 1 }] as const satisfies readonly { id: number }[];\nexport const pushed = [1];\npushed.push(2);\nexport const computed = [1, 2].map((n) => n * 2);\nconst local = ['c'];\nexport { local as renamed };\n`,
    'src/lib/index.ts': `export * from './data';\nexport { xs as viaBarrel } from './data.js';\n`,
    'src/lib/data.json': `["a", "b"]`,
    'src/lib/state.svelte.ts': `export const runes = ['a'];\n`,
    'src/lib/looped.ts': `export const looped = ['a'];\nfor (const x of looped) console.log(x);\n`,
    'src/lib/Widget.svelte': `<script module>export const xs = ['a'];</script>`
  };
  const COMPONENTS = {
    'src/lib/Alias.svelte': each("import { xs } from '$lib/data';"),
    'src/lib/Relative.svelte': each("import { xs } from './data.js';"),
    'src/lib/Barrel.svelte': each("import { viaBarrel as xs } from '$lib';"),
    'src/lib/Star.svelte': each("import { xs } from '$lib/index';"),
    'src/lib/AsConst.svelte': each("import { typed as xs } from '$lib/data';"),
    'src/lib/Renamed.svelte': each("import { renamed as xs } from '$lib/data';"),
    'src/lib/Namespace.svelte': each("import * as data from '$lib/data';", 'data.xs'),
    'src/lib/Pushed.svelte': each("import { pushed as xs } from '$lib/data';"),
    'src/lib/Computed.svelte': each("import { computed as xs } from '$lib/data';"),
    'src/lib/Package.svelte': each("import { xs } from 'some-package';"),
    'src/lib/Json.svelte': each("import xs from '$lib/data.json';"),
    'src/lib/JsonNamed.svelte': each("import { xs } from '$lib/data.json';"),
    'src/lib/Missing.svelte': each("import { xs } from '$lib/missing';"),
    'src/lib/RunesModule.svelte': each("import { runes as xs } from './state.svelte';"),
    'src/lib/RunesModuleJs.svelte': each("import { runes as xs } from '$lib/state.svelte.js';"),
    'src/lib/ForOf.svelte': each("import { looped as xs } from '$lib/looped';"),
    'src/lib/ComponentExport.svelte': each("import { xs } from './Widget.svelte';")
  };

  it('drops the block only when the export is a repo-local constant list', async () => {
    const rt = createMemoryRuntime({ ...PROJECT, ...MODULES, ...COMPONENTS });

    const { components } = await collectAll(rt, '', defaultConfig);

    const scanned = components.filter((c) => c.file in COMPONENTS && !c.parseFailed);
    expect(scanned).toHaveLength(Object.keys(COMPONENTS).length);
    const reported = components
      .filter((c) => c.file in COMPONENTS && c.eachBlocks.length > 0)
      .map((c) => c.file)
      .sort();
    expect(reported).toEqual([
      'src/lib/ComponentExport.svelte',
      'src/lib/Computed.svelte',
      'src/lib/Json.svelte',
      'src/lib/JsonNamed.svelte',
      'src/lib/Missing.svelte',
      'src/lib/Package.svelte',
      'src/lib/Pushed.svelte'
    ]);
  });
});
