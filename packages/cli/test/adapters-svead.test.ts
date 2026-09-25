import { describe, it, expect } from 'vitest';
import { findAdapter } from '../src/providers/source/adapters/index.js';
import { parseFile } from '../src/providers/source/parse.js';

function resolve(tag: string, imported = 'Head') {
  const use = parseFile(`<script>import { ${imported} } from 'svead';</script>${tag}`, 'x.svelte').components[0]!;
  const adapter = findAdapter({ source: 'svead', imported });
  expect(adapter).toBeDefined();
  return adapter!.resolve(use);
}

const opaqueSet = [
  { kind: 'title', value: 'dynamic' },
  { kind: 'meta', property: 'og:title', value: 'dynamic' },
  { kind: 'meta', name: 'description', value: 'dynamic' },
  { kind: 'meta', property: 'og:description', value: 'dynamic' },
  { kind: 'link', rel: 'canonical', value: 'dynamic' },
  { kind: 'meta', property: 'og:url', value: 'dynamic' },
  { kind: 'meta', property: 'og:image', value: 'dynamic' },
  { kind: 'meta', name: 'twitter:card', value: 'dynamic' }
];

describe('svead Head adapter', () => {
  it('renders its fixed tag set, values unknown, for a shorthand variable config', () => {
    const r = resolve('<Head {seo_config} />');
    expect(r).toEqual({ tags: opaqueSet, broad: false });
  });

  it('treats spread props and a config with a spread as unreadable, never as a broad source', () => {
    expect(resolve('<Head {...props} />')).toEqual({ tags: opaqueSet, broad: false });
    expect(resolve('<Head seo_config={{ ...base, title: "T" }} />')).toEqual({ tags: opaqueSet, broad: false });
  });

  it('reads an inline config literal key by key', () => {
    const r = resolve('<Head seo_config={{ title: "About", description: d, url: "https://x.dev/about" }} />');
    expect(r.broad).toBe(false);
    expect(r.tags).toEqual([
      { kind: 'title', value: 'static', text: 'About' },
      { kind: 'meta', property: 'og:title', value: 'static' },
      { kind: 'meta', name: 'description', value: 'dynamic' },
      { kind: 'meta', property: 'og:description', value: 'dynamic' },
      { kind: 'link', rel: 'canonical', value: 'static' },
      { kind: 'meta', property: 'og:url', value: 'static' },
      { kind: 'meta', name: 'twitter:card', value: 'static' }
    ]);
  });

  it('credits og:image only when the literal sets open_graph_image', () => {
    const r = resolve('<Head seo_config={{ title: "T", description: "D", url: "/", open_graph_image: img }} />');
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:image', value: 'dynamic' });
  });

  it('does not credit og:image for an empty literal open_graph_image', () => {
    const r = resolve('<Head seo_config={{ title: "T", description: "D", url: "/", open_graph_image: "" }} />');
    expect(r.tags.some((t) => t.property === 'og:image')).toBe(false);
  });

  it('treats an inline config as unreadable when a later spread may replace it', () => {
    expect(resolve('<Head seo_config={{ title: "Original", description: "D", url: "/" }} {...props} />')).toEqual({
      tags: opaqueSet,
      broad: false
    });
    const before = resolve('<Head {...props} seo_config={{ title: "Kept", description: "D", url: "/" }} />');
    expect(before.tags).toContainEqual({ kind: 'title', value: 'static', text: 'Kept' });
  });

  it('keeps a dynamic twitter_card_type dynamic', () => {
    const r = resolve('<Head seo_config={{ title: "T", twitter_card_type: kind }} />');
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'dynamic' });
  });

  it('reads the per-prop API of svead before 0.0.10, with og:* and twitter:card only alongside image', () => {
    expect(resolve('<Head title="T" description={d} url="/" />')).toEqual({
      tags: [
        { kind: 'title', value: 'static', text: 'T' },
        { kind: 'meta', name: 'description', value: 'dynamic' },
        { kind: 'link', rel: 'canonical', value: 'static' }
      ],
      broad: false
    });
    const empty = resolve('<Head title="T" url="/" image="" />');
    expect(empty.tags.some((t) => t.property === 'og:image' || t.name === 'twitter:card')).toBe(false);
    const r = resolve('<Head title="T" url="/" image={img} />');
    expect(r.tags).toContainEqual({ kind: 'meta', property: 'og:image', value: 'dynamic' });
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'twitter:card', value: 'dynamic' });
  });
});

describe('svead SchemaOrg adapter', () => {
  it('emits a dynamic jsonld tag', () => {
    expect(resolve('<SchemaOrg {schema} />', 'SchemaOrg')).toEqual({
      tags: [{ kind: 'jsonld', value: 'dynamic' }],
      broad: false
    });
  });
});
