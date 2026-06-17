import type { HeadProvider, HeadTag, ResolvedHead, Runtime } from '@svelte-vitals/core';
import { enumerateRoutePages } from './project.js';
import { parseHeadTags, type ParsedTag } from './parse.js';

const ROUTES_DIR = 'src/routes';

/** glob/tinyglobby returns POSIX-separated paths on every platform, so we split on '/'. */
function isGroupSegment(segment: string): boolean {
  return /^\(.+\)$/.test(segment);
}

/** Derive the route path from a +page.svelte path, dropping (group) dirs (design §5). */
export function deriveRoute(pageRel: string): string {
  const inner = pageRel.slice(`${ROUTES_DIR}/`.length, -'/+page.svelte'.length);
  const segments = inner.length === 0 ? [] : inner.split('/').filter((s) => !isGroupSegment(s));
  return '/' + segments.join('/');
}

/**
 * Build the layout chain (root → leaf) for a route, then append the page itself.
 * All layout levels are resolved (design §5); +layout@/+page@ breakouts are not.
 */
async function chainFiles(rt: Runtime, cwd: string, pageRel: string): Promise<Array<{ rel: string; isPage: boolean }>> {
  const dir = pageRel.slice(0, -'/+page.svelte'.length); // 'src/routes/blog/[slug]'
  const extra = dir.slice(ROUTES_DIR.length); // '' or '/blog/[slug]'
  const segments = extra.length === 0 ? [] : extra.split('/').filter(Boolean);

  const files: Array<{ rel: string; isPage: boolean }> = [];
  let prefix = ROUTES_DIR;
  for (let i = 0; i <= segments.length; i++) {
    if (i > 0) prefix = `${prefix}/${segments[i - 1]}`;
    const layout = `${prefix}/+layout.svelte`;
    if (await rt.exists(rt.join(cwd, layout))) files.push({ rel: layout, isPage: false });
  }
  files.push({ rel: pageRel, isPage: true });
  return files;
}

/** Stable identity for overriding the same logical tag across the chain. */
function keyOf(tag: ParsedTag): string {
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

/** Compose the effective head for one route by walking its chain (child overrides parent). */
async function resolveRoute(rt: Runtime, cwd: string, pageRel: string): Promise<ResolvedHead> {
  const files = await chainFiles(rt, cwd, pageRel);
  const composed = new Map<string, HeadTag>();
  for (const { rel, isPage } of files) {
    const source = await rt.readFile(rt.join(cwd, rel));
    for (const tag of parseHeadTags(source, rel)) {
      composed.set(keyOf(tag), { ...tag, presence: isPage ? 'own' : 'inherited', file: rel });
    }
  }
  return {
    route: deriveRoute(pageRel),
    source: 'static',
    tags: [...composed.values()],
    file: pageRel
  };
}

/**
 * SourceHeadProvider — static mode. Reads route files through the Runtime only
 * and builds the mode-independent ResolvedHead[] boundary (design §8).
 */
export const sourceHeadProvider: HeadProvider = {
  mode: 'static',
  async collect(rt, cwd) {
    const pages = await enumerateRoutePages(rt, cwd);
    return Promise.all(pages.map((page) => resolveRoute(rt, cwd, page)));
  }
};
