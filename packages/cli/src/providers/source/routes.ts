import type {
  Config,
  HeadTag,
  HeadingInfo,
  ImageInfo,
  ResolvedHead,
  ResolvedHeadings,
  ResolvedImages,
  Runtime
} from '@svelte-vitals/core';
import { defaultConfig } from '@svelte-vitals/core';
import { enumerateRoutePages } from './project.js';
import { resolveFileTags, readAndParse, BROAD_KINDS, tagKey, type ParseCache } from './resolve.js';

const ROUTES_DIR = 'src/routes';
const MAX_DEPTH = 5;

/** glob/tinyglobby returns POSIX-separated paths on every platform, so we split on '/'. */
function isGroupSegment(segment: string): boolean {
  return /^\(.+\)$/.test(segment);
}

/** Directory of a route file (everything before the trailing `/+page…` or `/+layout…`). */
function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i >= 0 ? rel.slice(0, i) : '';
}

/** Segments of a directory under src/routes, e.g. 'src/routes/(app)/item' → ['(app)','item']. */
function dirSegments(dir: string): string[] {
  const extra = dir.slice(ROUTES_DIR.length); // '' or '/(app)/item'
  return extra.length === 0 ? [] : extra.split('/').filter(Boolean);
}

/** Directory rel path for a list of segments. */
function dirKey(segs: string[]): string {
  return segs.length === 0 ? ROUTES_DIR : `${ROUTES_DIR}/${segs.join('/')}`;
}

/** The `@`-segment of a +page@/+layout@ file: '' for `@`, the name for `@seg`, or null when there is no `@`. */
function parseAt(rel: string): string | null {
  const file = rel.slice(rel.lastIndexOf('/') + 1);
  const m = /^\+(?:page|layout)@(.*)\.svelte$/.exec(file);
  return m ? m[1]! : null;
}

/**
 * Directory segments a `@`-leaf attaches to: null = default (own dir), [] = root,
 * else the prefix up to the LAST segment equal to the `@`-segment (null when the
 * segment is unknown → caller falls back to the default, never crashes).
 *
 * `strictAncestor` excludes the file's own directory segment from the search:
 * a `+layout@seg` resets to a STRICT ancestor (a layout cannot be its own parent),
 * so a `+layout@b` in `…/b` must target an outer `b`, never itself. A page leaf may
 * legitimately attach to its own directory's layout, so it keeps the full search.
 */
function atTarget(rel: string, dirSegs: string[], strictAncestor = false): string[] | null {
  const at = parseAt(rel);
  if (at === null) return null; // no breakout
  if (at === '') return []; // root layout
  const haystack = strictAncestor ? dirSegs.slice(0, -1) : dirSegs;
  const i = haystack.lastIndexOf(at);
  return i >= 0 ? dirSegs.slice(0, i + 1) : null;
}

/** Derive the route path from a +page(@…).svelte path, dropping (group) dirs (design §5; #12). */
export function deriveRoute(pageRel: string): string {
  const segments = dirSegments(dirOf(pageRel)).filter((s) => !isGroupSegment(s));
  return '/' + segments.join('/');
}

/** Index every +layout.svelte / +layout@*.svelte by its directory (one layout per dir) (#12). */
export async function collectLayouts(rt: Runtime, cwd: string): Promise<Map<string, string>> {
  const [plain, breakout] = await Promise.all([
    rt.glob(`${ROUTES_DIR}/**/+layout.svelte`, cwd),
    rt.glob(`${ROUTES_DIR}/**/+layout@*.svelte`, cwd)
  ]);
  const map = new Map<string, string>();
  for (const rel of [...plain, ...breakout]) map.set(dirOf(rel), rel);
  return map;
}

/** Nearest layout at or above `segs` (walking the prefix down to root), or null. */
function layoutAtOrAbove(segs: string[], layouts: Map<string, string>): { segs: string[]; rel: string } | null {
  for (let j = segs.length; j >= 0; j--) {
    const rel = layouts.get(dirKey(segs.slice(0, j)));
    if (rel) return { segs: segs.slice(0, j), rel };
  }
  return null;
}

/**
 * Build the breakout-aware layout chain (root → leaf) then append the page (#12).
 * The page's own `@` chooses where to attach; each layout's own `@` can reset its
 * parent. A `seen` set guards against cycles.
 */
export function chainFiles(pageRel: string, layouts: Map<string, string>): Array<{ rel: string; isPage: boolean }> {
  const pageSegs = dirSegments(dirOf(pageRel));
  let dir: string[] | null = atTarget(pageRel, pageSegs) ?? pageSegs;

  const chain: string[] = [];
  const seen = new Set<string>();
  while (dir !== null) {
    const found = layoutAtOrAbove(dir, layouts);
    if (!found || seen.has(found.rel)) break;
    seen.add(found.rel);
    chain.unshift(found.rel);
    const reset = atTarget(found.rel, found.segs, true);
    // default (or unknown segment) → parent is strictly above the layout's dir;
    // a `+layout@seg` that names a strict ancestor jumps straight to it.
    dir = reset !== null && reset.length < found.segs.length ? reset : found.segs.slice(0, -1);
    if (dir.length === 0 && found.segs.length === 0) dir = null; // passed root
  }

  return [...chain.map((rel) => ({ rel, isPage: false })), { rel: pageRel, isPage: true }];
}

/** Per-route facts produced by a single walk of the layout chain. */
interface RouteFacts {
  head: ResolvedHead;
  images: ResolvedImages;
  headings: ResolvedHeadings;
}

/**
 * Resolve one route by walking its layout chain once: each file is read and
 * parsed a single time, yielding both the composed head (child overrides parent)
 * and the route's <img> facts. Heads and images therefore share one parse pass.
 */
async function resolveRoute(
  rt: Runtime,
  cwd: string,
  pageRel: string,
  config: Config,
  layouts: Map<string, string>,
  cache: ParseCache
): Promise<RouteFacts> {
  const files = chainFiles(pageRel, layouts);
  const composed = new Map<string, HeadTag>();
  let broadOwn = false;
  let broadInherited = false;
  const images: ImageInfo[] = [];
  const headings: HeadingInfo[] = [];

  for (const { rel, isPage } of files) {
    const parsed = await readAndParse(rt, cwd, rel, cache);

    for (const img of parsed.images) {
      images.push({ ...img, file: rel });
    }
    for (const heading of parsed.headings) {
      headings.push({ ...heading, file: rel });
    }

    const resolved = await resolveFileTags(rt, cwd, rel, parsed, config, MAX_DEPTH, new Set([rel]), cache);
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

  const route = deriveRoute(pageRel);
  return {
    head: { route, source: 'static', tags: [...composed.values()], file: pageRel },
    images: { route, images },
    headings: { route, headings }
  };
}

/**
 * Static-mode collection: enumerate route pages and walk each route's layout
 * chain exactly once, returning both the mode-independent ResolvedHead[] (design
 * §8) and the per-route ResolvedImages[] for Performance rules from a single
 * parse pass per file.
 *
 * `cache` defaults to a fresh, single-call `ParseCache` (existing callers are
 * unaffected). A caller that re-analyzes the same project repeatedly (the vite
 * dev dashboard) can pass in a long-lived cache and invalidate only the entries
 * for files that actually changed between calls, so unchanged routes/layouts
 * are never re-read or re-parsed.
 */
export async function collectRoutes(
  rt: Runtime,
  cwd: string,
  config: Config = defaultConfig,
  cache: ParseCache = new Map()
): Promise<{ heads: ResolvedHead[]; images: ResolvedImages[]; headings: ResolvedHeadings[] }> {
  const [pages, layouts] = await Promise.all([enumerateRoutePages(rt, cwd), collectLayouts(rt, cwd)]);
  const facts = await Promise.all(pages.map((page) => resolveRoute(rt, cwd, page, config, layouts, cache)));
  return {
    heads: facts.map((f) => f.head),
    images: facts.map((f) => f.images),
    headings: facts.map((f) => f.headings)
  };
}
