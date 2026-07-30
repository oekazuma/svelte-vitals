import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core';
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

  it('filters route-scoped facts and skips component/kit-module scanning when route is set', async () => {
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
