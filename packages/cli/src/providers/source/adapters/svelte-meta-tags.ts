/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import { attrValueOf, attrTextOf } from '../parse.js';
import type { Adapter, AdapterResult } from './types.js';

type Node = any;

function findAttr(attributes: Node[], name: string): Node | undefined {
  return attributes.find((a) => a?.type === 'Attribute' && a.name === name);
}

/** svelte-meta-tags <MetaTags> (named import) or the MetaTags.svelte subpath (default import). */
export const svelteMetaTagsAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    if (info.source === 'svelte-meta-tags') return info.imported === 'MetaTags';
    if (info.source === 'svelte-meta-tags/MetaTags.svelte') return info.imported === 'default';
    return false;
  },

  resolve(use: ComponentUse): AdapterResult {
    const tags: ParsedTag[] = [];
    const attrs = use.attributes;

    const titleAttr = findAttr(attrs, 'title');
    const templateAttr = findAttr(attrs, 'titleTemplate');
    const title = titleAttr ?? templateAttr;
    if (title) {
      const value = attrValueOf(title);
      // Capture measurable text only for a bare static title — not the template itself
      // (a `%s | …` pattern), and not when a titleTemplate wraps the title (the rendered
      // title would be longer, so measuring the literal alone would false-positive SEO022).
      const text = titleAttr && !templateAttr && value === 'static' ? attrTextOf(titleAttr) : undefined;
      tags.push({ kind: 'title', value, ...(text !== undefined ? { text } : {}) });
    }

    const description = findAttr(attrs, 'description');
    if (description) {
      const value = attrValueOf(description);
      const text = value === 'static' ? attrTextOf(description) : undefined;
      tags.push({ kind: 'meta', name: 'description', value, ...(text !== undefined ? { text } : {}) });
    }

    const canonical = findAttr(attrs, 'canonical');
    if (canonical) tags.push({ kind: 'link', rel: 'canonical', value: attrValueOf(canonical) });

    const robots = findAttr(attrs, 'robots');
    if (robots) tags.push({ kind: 'meta', name: 'robots', value: attrValueOf(robots) });

    // openGraph is an object prop we don't introspect; treat it as a broad og:* source.
    const openGraph = findAttr(attrs, 'openGraph');
    const broad = use.hasSpread || Boolean(openGraph);

    return { tags, broad };
  }
};
