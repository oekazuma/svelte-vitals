import { describe, it, expect } from 'vitest';
import { defaultConfig, defineConfig } from '@svelte-vitals/core';
import { parseFile } from '../src/providers/source/parse.js';
import { resolveFileTags, BROAD_KINDS, tagKey } from '../src/providers/source/resolve.js';
import { createMemoryRuntime } from './helpers/memory-runtime.js';

const rt = createMemoryRuntime({});

async function resolve(src: string, config = defaultConfig) {
  const parsed = parseFile(src, 'src/routes/+page.svelte');
  return resolveFileTags(rt, '', 'src/routes/+page.svelte', parsed, config, 5, new Set());
}

describe('resolveFileTags (layers 2 & 4)', () => {
  it('keeps layer-1 svelte:head tags', async () => {
    const r = await resolve('<svelte:head><title>About</title></svelte:head>');
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static' });
    expect(r.broad).toBe(false);
  });

  it('resolves an adapter component title prop', async () => {
    const r = await resolve(
      `<script>import { MetaTags } from 'svelte-meta-tags';</script><MetaTags title={data.title} />`
    );
    expect(r.tags).toContainEqual({ kind: 'title', value: 'dynamic' });
  });

  it('marks broad for an adapter component with spread props', async () => {
    const r = await resolve(`<script>import { MetaTags } from 'svelte-meta-tags';</script><MetaTags {...meta} />`);
    expect(r.broad).toBe(true);
  });

  it('marks broad for a metaComponents-declared component', async () => {
    const r = await resolve(`<Widget />`, defineConfig({ metaComponents: ['Widget'] }));
    expect(r.broad).toBe(true);
  });

  it('does NOT suppress for an unknown, undeclared component', async () => {
    const r = await resolve(`<Button />`);
    expect(r.broad).toBe(false);
    expect(r.tags).toHaveLength(0);
  });

  it('BROAD_KINDS includes a dynamic title', () => {
    expect(BROAD_KINDS).toContainEqual({ kind: 'title', value: 'dynamic' });
  });

  it('tagKey distinguishes kinds', () => {
    expect(tagKey({ kind: 'title', value: 'static' })).toBe('title');
    expect(tagKey({ kind: 'meta', name: 'description', value: 'static' })).toBe('meta:name=description');
  });
});
