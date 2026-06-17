/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import { attrValueOf } from '../parse.js';
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

    const title = findAttr(attrs, 'title') ?? findAttr(attrs, 'titleTemplate');
    if (title) tags.push({ kind: 'title', value: attrValueOf(title) });

    const description = findAttr(attrs, 'description');
    if (description) tags.push({ kind: 'meta', name: 'description', value: attrValueOf(description) });

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
