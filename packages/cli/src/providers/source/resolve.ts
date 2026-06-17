import type { Config, Runtime } from '@svelte-vitals/core';
import type { ParsedFile, ParsedTag } from './parse.js';
import { findAdapter } from './adapters/index.js';

export interface ResolveResult {
  tags: ParsedTag[];
  broad: boolean;
}

/** Tag kinds a broad (opaque) meta source is assumed to possibly set, all dynamic. */
export const BROAD_KINDS: ParsedTag[] = [
  { kind: 'title', value: 'dynamic' },
  { kind: 'meta', name: 'description', value: 'dynamic' },
  { kind: 'link', rel: 'canonical', value: 'dynamic' },
  { kind: 'meta', property: 'og:title', value: 'dynamic' },
  { kind: 'meta', property: 'og:image', value: 'dynamic' },
  { kind: 'meta', name: 'robots', value: 'dynamic' }
];

/** Stable identity for a tag (matches routes.ts keyOf). */
export function tagKey(tag: ParsedTag): string {
  switch (tag.kind) {
    case 'title':
      return 'title';
    case 'meta':
      return `meta:${tag.name ? `name=${tag.name}` : tag.property ? `prop=${tag.property}` : '?'}`;
    case 'link':
      return `link:${tag.rel ?? '?'}`;
    case 'jsonld':
      return 'jsonld';
  }
}

/**
 * Resolve a file's specific head tags (layer 1 + component layers 2/3/4) and whether
 * a broad (opaque) meta source is present. Transitive recursion is added in Task 7.
 */
export async function resolveFileTags(
  rt: Runtime,
  cwd: string,
  fileRel: string,
  parsed: ParsedFile,
  config: Config,
  depth: number,
  visited: Set<string>
): Promise<ResolveResult> {
  const tags: ParsedTag[] = [...parsed.headTags];
  let broad = false;

  for (const use of parsed.components) {
    const info = parsed.imports.get(use.name);

    // Layer 2: known-package adapter.
    const adapter = info ? findAdapter(info) : undefined;
    if (adapter) {
      const result = adapter.resolve(use);
      tags.push(...result.tags);
      broad = broad || result.broad;
      continue;
    }

    // Layer 4: explicitly declared meta component (content unknown -> broad).
    if (config.metaComponents.includes(use.name)) {
      broad = true;
      continue;
    }

    // Layer 3 (transitive) is added in Task 7. Until then, unresolved -> no suppression.
    void rt;
    void cwd;
    void fileRel;
    void depth;
    void visited;
  }

  return { tags, broad };
}
