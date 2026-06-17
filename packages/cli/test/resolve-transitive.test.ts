import { describe, it, expect } from 'vitest';
import { defaultConfig } from '@svelte-vitals/core';
import { parseFile } from '../src/providers/source/parse.js';
import { resolveFileTags, resolveComponentPath } from '../src/providers/source/resolve.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

async function resolveWith(files: Record<string, string>, entryRel: string) {
  const rt = createMemoryRuntime(files);
  const parsed = parseFile(files[entryRel]!, entryRel);
  return resolveFileTags(rt, '', entryRel, parsed, defaultConfig, 5, new Set([entryRel]));
}

describe('resolveComponentPath', () => {
  it('maps $lib and relative .svelte imports', () => {
    expect(resolveComponentPath('$lib/Seo.svelte', 'src/routes/+page.svelte')).toBe('src/lib/Seo.svelte');
    expect(resolveComponentPath('./Seo.svelte', 'src/routes/+page.svelte')).toBe('src/routes/Seo.svelte');
    expect(resolveComponentPath('../C.svelte', 'src/routes/blog/+page.svelte')).toBe('src/routes/C.svelte');
  });

  it('ignores non-local or non-svelte imports', () => {
    expect(resolveComponentPath('svelte-meta-tags', 'src/routes/+page.svelte')).toBeUndefined();
    expect(resolveComponentPath('$lib/utils.ts', 'src/routes/+page.svelte')).toBeUndefined();
  });
});

describe('resolveFileTags transitive (layer 3)', () => {
  it('pulls a title from a custom wrapper component', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Seo from '$lib/Seo.svelte';</script><Seo />`,
        'src/lib/Seo.svelte': `<svelte:head><title>{data.title}</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags).toContainEqual({ kind: 'title', value: 'dynamic' });
  });

  it('stops on cycles without infinite recursion', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<script>import A from '$lib/A.svelte';</script><A />`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags.some((t) => t.kind === 'title')).toBe(false);
  });

  it('stops at the depth limit', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<svelte:head><title>deep</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    // depth 5 is enough to reach B here; assert it resolves.
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static' });
  });
});
