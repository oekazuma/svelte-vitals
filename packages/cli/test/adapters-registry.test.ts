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
    const r = adapter!.resolve(
      useOf(`import Seo from 'svelte-seo';`, '<Seo title="Hi" description="A concise summary." />')
    );
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static', text: 'Hi' });
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'description', value: 'static', text: 'A concise summary.' });
  });

  it('introspects the svelte-seo openGraph/twitter literals', () => {
    const adapter = findAdapter({ source: 'svelte-seo', imported: 'default' })!;
    const r = adapter.resolve(
      useOf(
        `import Seo from 'svelte-seo';`,
        '<Seo openGraph={{ url: u, description: "d" }} twitter={{ card: "summary" }} />'
      )
    );
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:url', value: 'dynamic' });
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:description', value: 'static' });
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'static' });
    expect(r.broad).toBe(false);
  });

  it('falls back to broad when svelte-seo openGraph is a variable', () => {
    const adapter = findAdapter({ source: 'svelte-seo', imported: 'default' })!;
    const r = adapter.resolve(useOf(`import Seo from 'svelte-seo';`, '<Seo openGraph={cfg} />'));
    expect(r.broad).toBe(true);
  });

  it('returns undefined for unknown modules', () => {
    expect(findAdapter({ source: 'lodash', imported: 'default' })).toBeUndefined();
  });
});
