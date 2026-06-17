import { describe, it, expect } from 'vitest';
import { parse } from 'svelte/compiler';
import { collectImports } from '../src/providers/source/imports.js';

function imports(src: string) {
  return collectImports(parse(src, { modern: true }));
}

describe('collectImports', () => {
  it('captures named, aliased, and default imports from instance and module scripts', () => {
    const map = imports(
      `<script module>import Mod from 'mod';</script>` +
        `<script>import { MetaTags } from 'svelte-meta-tags'; import { MetaTags as M } from 'svelte-meta-tags'; import Seo from 'svelte-seo'; import Wrap from '$lib/Seo.svelte';</script>`
    );
    expect(map.get('MetaTags')).toEqual({ source: 'svelte-meta-tags', imported: 'MetaTags' });
    expect(map.get('M')).toEqual({ source: 'svelte-meta-tags', imported: 'MetaTags' });
    expect(map.get('Seo')).toEqual({ source: 'svelte-seo', imported: 'default' });
    expect(map.get('Wrap')).toEqual({ source: '$lib/Seo.svelte', imported: 'default' });
    expect(map.get('Mod')).toEqual({ source: 'mod', imported: 'default' });
  });

  it('returns an empty map when there is no script', () => {
    expect(imports('<title>x</title>').size).toBe(0);
  });
});
