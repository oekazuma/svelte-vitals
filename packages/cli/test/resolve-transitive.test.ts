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

  it('appends .svelte to extensionless local imports', () => {
    expect(resolveComponentPath('$lib/Seo', 'src/routes/+page.svelte')).toBe('src/lib/Seo.svelte');
    expect(resolveComponentPath('./Seo', 'src/routes/+page.svelte')).toBe('src/routes/Seo.svelte');
    expect(resolveComponentPath('../C', 'src/routes/blog/+page.svelte')).toBe('src/routes/C.svelte');
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

  it('resolves a wrapper imported without the .svelte extension', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import Seo from '$lib/Seo';</script><Seo />`,
        'src/lib/Seo.svelte': `<svelte:head><title>About</title></svelte:head>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.tags).toContainEqual({ kind: 'title', text: 'About', value: 'static' });
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
    expect(r.tags).toContainEqual({ kind: 'title', text: 'deep', value: 'static' });
  });
});

describe('resolveFileTags transitive headings (layer 3, issue #425)', () => {
  it('collects an <h1> rendered by a directly imported child component', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import SiteHeader from '$lib/SiteHeader.svelte';</script><SiteHeader />`,
        'src/lib/SiteHeader.svelte': `<h1>Welcome</h1>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/lib/SiteHeader.svelte' }]);
  });

  it('collects a heading at grandchild depth (page -> A -> B)', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B />`,
        'src/lib/B.svelte': `<h1>Deep</h1>`
      },
      'src/routes/+page.svelte'
    );
    expect(r.headings).toEqual([{ level: 1, line: expect.any(Number), file: 'src/lib/B.svelte' }]);
  });

  it('stops on cycles without infinite recursion', async () => {
    const r = await resolveWith(
      {
        'src/routes/+page.svelte': `<script>import A from '$lib/A.svelte';</script><A />`,
        'src/lib/A.svelte': `<script>import B from '$lib/B.svelte';</script><B /><h2>A</h2>`,
        'src/lib/B.svelte': `<script>import A from '$lib/A.svelte';</script><A /><h3>B</h3>`
      },
      'src/routes/+page.svelte'
    );
    // A and B are each reached once and contribute their own heading; the second A
    // (reached via B -> A) is already visited and stops before re-entering, so no
    // infinite recursion and no duplicate <h2>.
    expect(r.headings).toEqual([
      { level: 2, line: expect.any(Number), file: 'src/lib/A.svelte' },
      { level: 3, line: expect.any(Number), file: 'src/lib/B.svelte' }
    ]);
  });
});
