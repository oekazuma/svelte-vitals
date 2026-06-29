import { describe, it, expect } from 'vitest';
import { parseComponentFacts } from '../src/providers/source/parse.js';
import { collectComponentFacts } from '../src/providers/source/components.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

describe('parseComponentFacts — each blocks (CORRECT001)', () => {
  it('detects keyed vs unkeyed {#each}', () => {
    const keyed = parseComponentFacts('{#each items as item (item.id)}<li>{item.name}</li>{/each}', 'C.svelte');
    expect(keyed.eachBlocks).toEqual([{ hasKey: true, line: 1 }]);
    const unkeyed = parseComponentFacts('{#each items as item}<li>{item}</li>{/each}', 'C.svelte');
    expect(unkeyed.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
  });
});

describe('parseComponentFacts — $effect (CORRECT002)', () => {
  const facts = (script: string) => parseComponentFacts(`<script>${script}</script>`, 'C.svelte').effects;

  it('flags an $effect whose body only assigns $state', () => {
    const e = facts('let count = $state(0); let double = $state(0); $effect(() => { double = count * 2; });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: true }]);
  });
  it('does not flag an $effect that does other work', () => {
    const e = facts('let count = $state(0); $effect(() => { console.log(count); });');
    expect(e).toEqual([{ line: 1, assignsOnlyState: false }]);
  });
  it('does not flag assignment to a non-$state variable', () => {
    const e = facts('let count = $state(0); let plain = 0; $effect(() => { plain = count; });');
    expect(e[0]!.assignsOnlyState).toBe(false);
  });
  it('reports no effects when there are none', () => {
    expect(facts('let count = $state(0);')).toEqual([]);
  });
});

describe('collectComponentFacts (memory runtime)', () => {
  it('scans every .svelte under src, including $lib', async () => {
    const rt = createMemoryRuntime({
      'src/routes/+page.svelte': '{#each xs as x}<i>{x}</i>{/each}',
      'src/lib/Card.svelte': '<script>let n = $state(0); let d = $state(0); $effect(() => { d = n + 1; });</script>',
      'src/app.html': '<html></html>' // not .svelte → ignored
    });
    const facts = await collectComponentFacts(rt, '');
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.svelte')!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
    expect(byFile.get('src/lib/Card.svelte')!.effects[0]!.assignsOnlyState).toBe(true);
    expect(byFile.has('src/app.html')).toBe(false);
  });
});
