import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectComponentFacts } from '../src/providers/source/components.js';

describe('collectComponentFacts (vite, real filesystem)', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sv-vite-components-'));
    await mkdir(join(root, 'src/routes'), { recursive: true });
    await mkdir(join(root, 'src/lib'), { recursive: true });
    await writeFile(join(root, 'src/routes/+page.svelte'), '{#each xs as x}<i>{x}</i>{/each}');
    await writeFile(
      join(root, 'src/lib/Card.svelte'),
      '<script>let n = $state(0); let d = $state(0); $effect(() => { d = n + 1; });</script>'
    );
    await writeFile(join(root, 'src/app.html'), '<html></html>'); // not .svelte → ignored
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it('scans every .svelte file under src/, including $lib', async () => {
    const facts = await collectComponentFacts(root);
    const byFile = new Map(facts.map((f) => [f.file, f]));
    expect(byFile.get('src/routes/+page.svelte')!.eachBlocks).toEqual([{ hasKey: false, line: 1 }]);
    expect(byFile.get('src/lib/Card.svelte')!.effects[0]!.assignsOnlyState).toBe(true);
    expect(byFile.has('src/app.html')).toBe(false);
  });

  it('returns an empty array when there is no src/ directory', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'sv-vite-components-empty-'));
    expect(await collectComponentFacts(empty)).toEqual([]);
    await rm(empty, { recursive: true, force: true });
  });
});
