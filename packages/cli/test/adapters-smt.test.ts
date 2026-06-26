import { describe, it, expect } from 'vitest';
import { svelteMetaTagsAdapter } from '../src/providers/source/adapters/svelte-meta-tags.js';
import { parseFile } from '../src/providers/source/parse.js';

function useOf(src: string) {
  return parseFile(`<script>import { MetaTags } from 'svelte-meta-tags';</script>${src}`, 'x.svelte').components[0]!;
}

describe('svelteMetaTagsAdapter', () => {
  it('matches the MetaTags named import', () => {
    expect(svelteMetaTagsAdapter.match({ source: 'svelte-meta-tags', imported: 'MetaTags' })).toBe(true);
    expect(svelteMetaTagsAdapter.match({ source: 'svelte-meta-tags', imported: 'JsonLd' })).toBe(false);
    expect(svelteMetaTagsAdapter.match({ source: 'other', imported: 'MetaTags' })).toBe(false);
  });

  it('maps a literal title prop to a static title tag with captured text', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags title="About" />'));
    expect(r.broad).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static', text: 'About' });
  });

  it('maps an expression title prop to a dynamic title tag (no captured text)', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags title={data.title} />'));
    expect(r.tags).toContainEqual({ kind: 'title', value: 'dynamic' });
  });

  it('captures a literal description prop as text (so SEO023 can measure it)', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags description="A concise summary." />'));
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'description', value: 'static', text: 'A concise summary.' });
  });

  it('does not capture title text when a titleTemplate wraps it (rendered title would be longer)', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags title="About" titleTemplate="%s | Acme" />'));
    expect(r.tags).toContainEqual({ kind: 'title', value: 'static' });
    expect(r.tags.find((t) => t.kind === 'title')!.text).toBeUndefined();
  });

  it('does not capture text from a bare titleTemplate (it is a %s pattern, not a title)', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags titleTemplate="%s | Acme" />'));
    expect(r.tags.find((t) => t.kind === 'title')!.text).toBeUndefined();
  });

  it('marks the result broad when props are spread', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags {...meta} />'));
    expect(r.broad).toBe(true);
  });

  it('emits no title tag when title prop is absent (so a missing title is still detectable)', () => {
    const r = svelteMetaTagsAdapter.resolve(useOf('<MetaTags description="d" />'));
    expect(r.broad).toBe(false);
    expect(r.tags.some((t) => t.kind === 'title')).toBe(false);
    expect(r.tags).toContainEqual({ kind: 'meta', name: 'description', value: 'static', text: 'd' });
  });
});
