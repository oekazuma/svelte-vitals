import { describe, it, expect } from 'vitest';
import { collectComponentFacts } from '@svelte-vitals/core';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

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
