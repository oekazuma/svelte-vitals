import type { ImportInfo } from '../imports.js';
import type { ParsedTag } from '../parse.js';
import type { Adapter, AdapterResult } from './types.js';

/**
 * svelte-meta-tags <JsonLd> (named import) or the JsonLd.svelte subpath (default import).
 * It renders a <script type="application/ld+json"> via a split-string {@html}, so it
 * can't be caught statically as literal JSON — model it as a dynamic jsonld tag so SEO008 passes.
 */
export const svelteMetaTagsJsonLdAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    if (info.source === 'svelte-meta-tags') return info.imported === 'JsonLd';
    if (info.source === 'svelte-meta-tags/JsonLd.svelte') return info.imported === 'default';
    return false;
  },

  resolve(): AdapterResult {
    const tags: ParsedTag[] = [{ kind: 'jsonld', value: 'dynamic' }];
    return { tags, broad: false };
  }
};
