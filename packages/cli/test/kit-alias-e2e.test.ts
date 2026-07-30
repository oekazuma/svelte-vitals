import { describe, it, expect } from 'vitest';
import { defaultConfig, securitySharedStateImport } from '@svelte-vitals/core';
import { collectAll } from '../src/collect-all.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

/**
 * security/shared-state-import is the rule whose behaviour visibly changes: every entry in the
 * runesModuleImports fact it reads passes through specifier resolution, and its `applies` is
 * "the fact is non-empty", so before alias resolution an alias-only project made it inert.
 */
const TREE = (config: string) => ({
  'src/app.html': `<!doctype html><html lang="en"><body></body></html>`,
  'svelte.config.js': config,
  'src/routes/+page.svelte': `<h1>a</h1>`,
  'src/data/cart.svelte.ts': `export const items = $state([]);\n`,
  'src/routes/+page.server.ts': `import { items } from '$data/cart.svelte';\nexport function load() {\n  return { count: items.length };\n}\n`
});

const findings = async (config: string) => {
  const facts = await collectAll(createMemoryRuntime(TREE(config)), '', defaultConfig);
  const results = await securitySharedStateImport.check({
    heads: [],
    project: facts.project,
    components: facts.components,
    kitModules: facts.kitModules,
    config: defaultConfig
  });
  return results.filter((r) => r.detection.presence === 'none' || r.detection.value === 'absent');
};

describe('kit.alias resolution, end to end', () => {
  it('reports a shared-state import that arrives through a declared alias', async () => {
    const fs = await findings(`export default { kit: { alias: { '$data': 'src/data' } } };`);

    expect(fs).toHaveLength(1);
    expect(fs[0]!.route).toBe('src/routes/+page.server.ts');
    expect(fs[0]!.message).toContain('$data/cart.svelte');
  });

  it('reports nothing for the same tree when the alias is not declared', async () => {
    // The negative control: without it, a rule that fired for some unrelated reason would
    // make the assertion above pass without alias resolution existing at all.
    expect(await findings(`export default { kit: {} };`)).toEqual([]);
  });
});
