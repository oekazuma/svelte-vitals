/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ImportInfo } from '../imports.js';
import type { ComponentUse, ParsedTag } from '../parse.js';
import { attrValueOf, attrTextOf } from '@svelte-vitals/core';
import type { Adapter, AdapterResult } from './types.js';

type Node = any;

function findAttr(attributes: Node[], name: string): Node | undefined {
  return attributes.find((a) => a?.type === 'Attribute' && a.name === name);
}

export const svelteSeoAdapter: Adapter = {
  match(info: ImportInfo): boolean {
    return info.source === 'svelte-seo' && info.imported === 'default';
  },

  resolve(use: ComponentUse): AdapterResult {
    const tags: ParsedTag[] = [];
    const attrs = use.attributes;

    const title = findAttr(attrs, 'title');
    if (title) {
      const value = attrValueOf(title);
      const text = value === 'static' ? attrTextOf(title) : undefined;
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

    const openGraph = findAttr(attrs, 'openGraph');
    const broad = use.hasSpread || Boolean(openGraph);

    return { tags, broad };
  }
};
