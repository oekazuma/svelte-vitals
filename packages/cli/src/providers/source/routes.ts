import type {
  Config,
  HeadProvider,
  HeadTag,
  ImageInfo,
  ResolvedHead,
  ResolvedImages,
  Runtime
} from '@svelte-vitals/core';
import { defaultConfig } from '@svelte-vitals/core';
import { enumerateRoutePages } from './project.js';
import { parseFile } from './parse.js';
import { resolveFileTags, BROAD_KINDS, tagKey } from './resolve.js';

const ROUTES_DIR = 'src/routes';
const MAX_DEPTH = 5;

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

/** Compose the effective head for one route by walking its chain (child overrides parent). */
async function resolveRoute(rt: Runtime, cwd: string, pageRel: string, config: Config): Promise<ResolvedHead> {
  const files = await chainFiles(rt, cwd, pageRel);
  const composed = new Map<string, HeadTag>();
  let broadOwn = false;
  let broadInherited = false;

  for (const { rel, isPage } of files) {
    const source = await rt.readFile(rt.join(cwd, rel));
    const parsed = parseFile(source, rel);
    const resolved = await resolveFileTags(rt, cwd, rel, parsed, config, MAX_DEPTH, new Set([rel]));

    for (const tag of resolved.tags) {
      composed.set(tagKey(tag), { ...tag, presence: isPage ? 'own' : 'inherited', file: rel });
    }
    if (resolved.broad) {
      if (isPage) broadOwn = true;
      else broadInherited = true;
    }
  }

  // Broad (opaque) meta source: fill only kinds not already set specifically.
  if (broadOwn || broadInherited) {
    const presence = broadOwn ? 'own' : 'inherited';
    for (const tag of BROAD_KINDS) {
      const key = tagKey(tag);
      if (!composed.has(key)) composed.set(key, { ...tag, presence });
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
  async collect(rt, cwd, config = defaultConfig) {
    const pages = await enumerateRoutePages(rt, cwd);
    return Promise.all(pages.map((page) => resolveRoute(rt, cwd, page, config)));
  }
};

/** Collect all <img> elements for one route across its layout chain. */
async function resolveRouteImages(
  rt: Runtime,
  cwd: string,
  pageRel: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _config: Config
): Promise<ResolvedImages> {
  const files = await chainFiles(rt, cwd, pageRel);
  const images: ImageInfo[] = [];
  for (const { rel } of files) {
    const source = await rt.readFile(rt.join(cwd, rel));
    const parsed = parseFile(source, rel);
    for (const img of parsed.images) {
      images.push({ ...img, file: rel });
    }
  }
  return { route: deriveRoute(pageRel), images };
}

/**
 * SourceImageProvider — static mode. Enumerates route pages, walks each route's
 * layout chain, and returns one ResolvedImages per route for Performance rules.
 */
export const sourceImageProvider = {
  async collect(rt: Runtime, cwd: string, config: Config = defaultConfig): Promise<ResolvedImages[]> {
    const pages = await enumerateRoutePages(rt, cwd);
    return Promise.all(pages.map((page) => resolveRouteImages(rt, cwd, page, config)));
  }
};
