import type { Config, Runtime } from '@svelte-vitals/core';
import type { ParsedFile, ParsedTag } from './parse.js';
import { findAdapter } from './adapters/index.js';
import { parseFile } from './parse.js';

interface ResolveResult {
  tags: ParsedTag[];
  broad: boolean;
}

/**
 * Per-run read+parse memo, keyed by project-root-relative path (as normalized by
 * chainFiles / resolveComponentPath). Shared across routes so a file imported by
 * many pages (a root layout, a common $lib component) is only parsed once per run.
 */
export type ParseCache = Map<string, Promise<ParsedFile>>;

/**
 * Read and parse `rel` at most once per cache. The cached value is a Promise (not
 * the resolved ParsedFile) so that concurrent callers racing on the same file
 * (collectRoutes resolves all routes in parallel) share a single in-flight parse
 * instead of triggering duplicate reads/parses.
 *
 * If the read or parse rejects, the rejected promise stays cached: every caller
 * that shares the file sees the same failure. This matches pre-cache behavior,
 * where a single malformed route file already failed the whole run (exit 2, see
 * Plan 002's characterization tests) — the cache does not change that contract.
 */
export function readAndParse(rt: Runtime, cwd: string, rel: string, cache: ParseCache): Promise<ParsedFile> {
  let hit = cache.get(rel);
  if (!hit) {
    hit = rt.readFile(rt.join(cwd, rel)).then((source) => parseFile(source, rel));
    cache.set(rel, hit);
  }
  return hit;
}

/** Tag kinds a broad (opaque) meta source is assumed to possibly set, all dynamic. */
export const BROAD_KINDS: ParsedTag[] = [
  { kind: 'title', value: 'dynamic' },
  { kind: 'meta', name: 'description', value: 'dynamic' },
  { kind: 'link', rel: 'canonical', value: 'dynamic' },
  { kind: 'meta', property: 'og:title', value: 'dynamic' },
  { kind: 'meta', property: 'og:description', value: 'dynamic' },
  { kind: 'meta', property: 'og:image', value: 'dynamic' },
  { kind: 'meta', property: 'og:url', value: 'dynamic' },
  { kind: 'meta', name: 'twitter:card', value: 'dynamic' },
  { kind: 'meta', name: 'robots', value: 'dynamic' }
  // jsonld is intentionally omitted: structured data is a distinct concern, not a
  // meta-tag family a broad meta source implies (JsonLd has its own adapter).
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
    case 'script':
      return `script:${tag.href ?? '?'}`;
  }
}

/** Map a local component import to a project-root-relative .svelte path, or undefined. */
export function resolveComponentPath(source: string, fromFileRel: string): string | undefined {
  let path: string;
  if (source.startsWith('$lib/')) {
    path = `src/lib/${source.slice('$lib/'.length)}`;
  } else if (source === '$lib') {
    return undefined;
  } else if (source.startsWith('./') || source.startsWith('../')) {
    const dir = fromFileRel.split('/').slice(0, -1);
    for (const seg of source.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') dir.pop();
      else dir.push(seg);
    }
    path = dir.join('/');
  } else {
    return undefined; // bare specifier (node_modules) — not transitively parsed (§11 boundary)
  }
  if (path.endsWith('.svelte')) return path;
  // A non-.svelte extension (.ts/.js/...) is not a component file we parse.
  if (/\.[^/]+$/.test(path)) return undefined;
  // Extensionless local import (e.g. `$lib/Seo`) — resolve to its .svelte file.
  // Projects that add `.svelte` to resolve.extensions import this way; the caller
  // guards with rt.exists, so a wrong guess is simply skipped (no false resolution).
  return `${path}.svelte`;
}

/**
 * Resolve a file's specific head tags (layer 1 + component layers 2/3/4) and whether
 * a broad (opaque) meta source is present. Includes transitive recursion (depth-limited, cycle-guarded).
 */
export async function resolveFileTags(
  rt: Runtime,
  cwd: string,
  fileRel: string,
  parsed: ParsedFile,
  config: Config,
  depth: number,
  visited: Set<string>,
  // Defaults to a fresh, single-call cache so existing direct callers (e.g. unit
  // tests exercising this function in isolation) don't need to pass one; real
  // callers (routes.ts) always pass the shared per-run cache explicitly.
  cache: ParseCache = new Map()
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

    // Layer 3: transitively resolve a user component in src/.
    const childRel = info ? resolveComponentPath(info.source, fileRel) : undefined;
    if (childRel && depth > 0 && !visited.has(childRel)) {
      const abs = rt.join(cwd, childRel);
      if (await rt.exists(abs)) {
        const childParsed = await readAndParse(rt, cwd, childRel, cache);
        const childVisited = new Set(visited).add(childRel);
        const child = await resolveFileTags(rt, cwd, childRel, childParsed, config, depth - 1, childVisited, cache);
        tags.push(...child.tags);
        broad = broad || child.broad;
      }
    }
    // Unresolved & undeclared components contribute nothing (strict).
  }

  return { tags, broad };
}
