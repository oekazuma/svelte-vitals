import type { ImportInfo } from '../imports.js';
import type { Adapter } from './types.js';
import { svelteMetaTagsAdapter } from './svelte-meta-tags.js';
import { svelteMetaTagsJsonLdAdapter } from './svelte-meta-tags-jsonld.js';
import { svelteSeoAdapter } from './svelte-seo.js';
import { sveadHeadAdapter, sveadSchemaOrgAdapter } from './svead.js';

/** Built-in known-package adapters (design §11 layer 2). */
const builtinAdapters: Adapter[] = [
  svelteMetaTagsAdapter,
  svelteMetaTagsJsonLdAdapter,
  svelteSeoAdapter,
  sveadHeadAdapter,
  sveadSchemaOrgAdapter
];

export function findAdapter(info: ImportInfo): Adapter | undefined {
  return builtinAdapters.find((adapter) => adapter.match(info));
}
