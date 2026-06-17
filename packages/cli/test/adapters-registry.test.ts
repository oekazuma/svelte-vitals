import { describe, it, expect } from 'vitest';
import { findAdapter } from '../src/providers/source/adapters/index.js';
import { parseFile } from '../src/providers/source/parse.js';

function useOf(imp: string, tag: string) {
  return parseFile(`<script>${imp}</script>${tag}`, 'x.svelte').components[0]!;
}

describe('adapter registry', () => {
  it('finds the svelte-meta-tags adapter', () => {
    expect(findAdapter({ source: 'svelte-meta-tags', imported: 'MetaTags' })).toBeDefined();
  });

  it('finds the svelte-seo adapter for the default import', () => {
    const adapter = findAdapter({ source: 'svelte-seo', imported: 'default' });
    expect(adapter).toBeDefined();
    const r = adapter!.resolve(useOf(`import Seo from 'svelte-seo';`, '<Seo title="Hi" />'));
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static' });
  });

  it('returns undefined for unknown modules', () => {
    expect(findAdapter({ source: 'lodash', imported: 'default' })).toBeUndefined();
  });
});
