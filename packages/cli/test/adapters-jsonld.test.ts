import { describe, it, expect } from 'vitest';
import { svelteMetaTagsJsonLdAdapter } from '../src/providers/source/adapters/svelte-meta-tags-jsonld.js';
import { findAdapter } from '../src/providers/source/adapters/index.js';
import { parseFile } from '../src/providers/source/parse.js';

function useOf(imp: string, tag: string) {
  return parseFile(`<script>${imp}</script>${tag}`, 'x.svelte').components[0]!;
}

describe('svelteMetaTagsJsonLdAdapter', () => {
  it('matches the JsonLd named import', () => {
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags', imported: 'JsonLd' })).toBe(true);
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags', imported: 'MetaTags' })).toBe(false);
  });

  it('matches the JsonLd.svelte default import subpath', () => {
    expect(svelteMetaTagsJsonLdAdapter.match({ source: 'svelte-meta-tags/JsonLd.svelte', imported: 'default' })).toBe(
      true
    );
  });

  it('emits a dynamic jsonld tag', () => {
    const r = svelteMetaTagsJsonLdAdapter.resolve(
      useOf(`import { JsonLd } from 'svelte-meta-tags';`, '<JsonLd schema={s} />')
    );
    expect(r.broad).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'jsonld', value: 'dynamic' });
  });

  it('is discoverable via findAdapter', () => {
    expect(findAdapter({ source: 'svelte-meta-tags', imported: 'JsonLd' })).toBe(svelteMetaTagsJsonLdAdapter);
  });
});
