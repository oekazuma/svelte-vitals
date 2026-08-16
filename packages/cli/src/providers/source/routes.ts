import type { Config } from '@svelte-vitals/core';
import type {
  A11yOccurrenceInfo,
  BranchStep,
  HeadTag,
  HeadingInfo,
  ImageInfo,
  KitAlias,
  ResolvedA11y,
  ResolvedHead,
  ResolvedHeadings,
  ResolvedImages,
  Runtime
} from '@svelte-vitals/core/internal';
import { defaultConfig, foldOccurrences, isTopFragment } from '@svelte-vitals/core/internal';
import type { A11yNode, ParsedFile } from './parse.js';
import { enumerateRoutePages } from './project.js';
import {
  resolveComponentPath,
  resolveFileTags,
  readAndParse,
  BROAD_KINDS,
  tagKey,
  type ParseCache
} from './resolve.js';

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
  a11y: ResolvedA11y;
}

/** A file's a11y occurrence, re-addressed into the composed route's branch space. */
type ComposedNode = A11yNode & { file: string; chain: boolean };

interface ComposeState {
  /**
   * Next free branch-group id. Every file instance gets its own range, so two component
   * instantiations' `{#if}` blocks are never folded as arms of one exclusive block.
   */
  nextGroup: number;
  fullyResolved: boolean;
}

interface ComposeCtx {
  rt: Runtime;
  cwd: string;
  config: Config;
  cache: ParseCache;
  aliases: readonly KitAlias[] | undefined;
  state: ComposeState;
}

/** Group ids a file occupies, so the next file instance can start above them. */
function groupSpan(nodes: A11yNode[]): number {
  let max = -1;
  for (const node of nodes) {
    for (const step of node.path) if (step.group > max) max = step.group;
  }
  return max + 1;
}

/** Paths are shared across every route that uses a parsed file — re-address by copying. */
function offsetPath(path: BranchStep[], base: number): BranchStep[] {
  return base === 0 ? path : path.map((step) => ({ group: step.group + base, branch: step.branch }));
}

/**
 * One file's contribution to the route: its own occurrences plus, inline at each component
 * usage, that component's contribution carrying the usage's branch address and repeatability.
 * Anything that cannot be followed (package/adapter/meta component, `<svelte:component>`,
 * a cycle, MAX_DEPTH) contributes nothing and opens the world — existential rules stay sound,
 * `no-missing-id-ref` skips the route.
 */
async function composeA11y(
  ctx: ComposeCtx,
  fileRel: string,
  parsed: ParsedFile,
  depth: number,
  visited: Set<string>,
  chain: boolean
): Promise<ComposedNode[]> {
  const { rt, cwd, state } = ctx;
  if (parsed.a11y.unknowableContent) state.fullyResolved = false;
  const base = state.nextGroup;
  state.nextGroup += groupSpan(parsed.a11y.nodes);

  const composed: ComposedNode[] = [];
  for (const node of parsed.a11y.nodes) {
    const path = offsetPath(node.path, base);
    if (node.kind !== 'component') {
      composed.push({ ...node, path, file: fileRel, chain });
      continue;
    }
    const info = ctx.config.metaComponents.includes(node.key) ? undefined : parsed.imports.get(node.key);
    // Package (incl. adapter) imports and the dynamic `<svelte:component>`/`<svelte:self>` names
    // resolve to no repo-local path, so they fall into the unresolved branch below.
    const childRel = info ? resolveComponentPath(info.source, fileRel, ctx.aliases) : undefined;
    if (!childRel || depth <= 0 || visited.has(childRel) || !(await rt.exists(rt.join(cwd, childRel)))) {
      state.fullyResolved = false;
      continue;
    }
    const childParsed = await readAndParse(rt, cwd, childRel, ctx.cache);
    const child = await composeA11y(ctx, childRel, childParsed, depth - 1, new Set(visited).add(childRel), false);
    for (const inner of child) {
      composed.push({ ...inner, path: [...path, ...inner.path], repeatable: node.repeatable || inner.repeatable });
    }
  }
  return composed;
}

/**
 * `<header>`/`<footer>` are banner/contentinfo only at a chain file's template top level: a
 * component's may sit inside sectioning content in its parent, and below the top level they
 * may be scoped by article/aside/main/nav/section, which strips the landmark mapping
 * (HTML-AAM). `<main>` and literal landmark roles count everywhere.
 */
function countsAsLandmark(node: ComposedNode): boolean {
  return node.topLevel === undefined || (node.chain && node.topLevel === true);
}

/**
 * The order the findings spec pins for representatives, because it decides which one is the
 * unpenalized first: chain files in chain order by line, then component files by path and line.
 */
function representativeOrder(chainOrder: Map<string, number>) {
  return (a: ComposedNode, b: ComposedNode): number => {
    const rankA = a.chain ? (chainOrder.get(a.file) ?? 0) : chainOrder.size;
    const rankB = b.chain ? (chainOrder.get(b.file) ?? 0) : chainOrder.size;
    if (rankA !== rankB) return rankA - rankB;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    return a.line - b.line;
  };
}

function representatives(nodes: ComposedNode[], chainOrder: Map<string, number>): Record<string, A11yOccurrenceInfo[]> {
  const folded = foldOccurrences(nodes);
  const order = representativeOrder(chainOrder);
  return Object.fromEntries(
    [...folded].map(([key, list]) => [key, list.sort(order).map(({ file, line }) => ({ file, line }))])
  );
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
  cache: ParseCache,
  aliases: readonly KitAlias[] | undefined,
  appHtmlIds: readonly string[] | undefined
): Promise<RouteFacts> {
  const files = chainFiles(pageRel, layouts);
  const chainOrder = new Map(files.map((f, i) => [f.rel, i]));
  const composed = new Map<string, HeadTag>();
  // Additive kinds survive in chain order (root layout -> ... -> page) and source order
  // within a file, unlike composed's override-by-kind semantics for title/meta: JSON-LD
  // (issue #443), every <link> except canonical (preload/preconnect/alternate/icon/…
  // legitimately repeat with the same rel), and <script src> (a layout's script and a page's
  // same-src script both render, so a page-level `defer` copy must not mask the layout's
  // blocking one). Canonical stays in `composed` because the broad-source fill below keys on
  // `link:canonical`; if it were additive, a static canonical would sit next to a synthetic
  // dynamic one and detection would degrade.
  const additiveTags: HeadTag[] = [];
  let broadOwn = false;
  let broadInherited = false;
  const images: ImageInfo[] = [];
  const headings: HeadingInfo[] = [];
  const componentHeadings: HeadingInfo[] = [];
  const a11yCtx: ComposeCtx = { rt, cwd, config, cache, aliases, state: { nextGroup: 0, fullyResolved: true } };
  const a11yNodes: ComposedNode[] = [];
  const nestedLandmarks: ResolvedA11y['nestedLandmarks'] = [];
  /** Landmark the layouts above the current chain file render their children inside. */
  let slotLandmark: string | undefined;

  for (const { rel, isPage } of files) {
    const parsed = await readAndParse(rt, cwd, rel, cache);

    const contributed = await composeA11y(a11yCtx, rel, parsed, MAX_DEPTH, new Set([rel]), true);
    for (const node of contributed) {
      if (!node.chain || node.kind !== 'landmark' || !countsAsLandmark(node) || node.repeatable) continue;
      const within = node.inLandmark ?? slotLandmark;
      if (within) nestedLandmarks.push({ kind: node.key, within, file: node.file, line: node.line });
    }
    slotLandmark = parsed.a11y.slotInLandmark ?? slotLandmark;
    a11yNodes.push(...contributed);

    for (const img of parsed.images) {
      images.push({ ...img, file: rel });
    }
    for (const heading of parsed.headings) {
      headings.push({ ...heading, file: rel });
    }

    const resolved = await resolveFileTags(rt, cwd, rel, parsed, config, MAX_DEPTH, new Set([rel]), cache, aliases);
    for (const tag of resolved.tags) {
      const stamped: HeadTag = { ...tag, presence: isPage ? 'own' : 'inherited', file: rel };
      if (tag.kind === 'jsonld' || tag.kind === 'script' || (tag.kind === 'link' && tag.rel !== 'canonical'))
        additiveTags.push(stamped);
      else composed.set(tagKey(tag), stamped);
    }
    if (resolved.broad) {
      if (isPage) broadOwn = true;
      else broadInherited = true;
    }
    componentHeadings.push(...resolved.headings);
  }

  // Broad (opaque) meta source: fill only kinds not already set specifically.
  if (broadOwn || broadInherited) {
    const presence = broadOwn ? 'own' : 'inherited';
    for (const tag of BROAD_KINDS) {
      const key = tagKey(tag);
      if (!composed.has(key)) composed.set(key, { ...tag, presence });
    }
  }

  const idNodes = a11yNodes.filter((n) => n.kind === 'id');
  // An expression-valued id (key '') is unknowable: it closes no world and is no candidate.
  if (idNodes.some((n) => n.key === '')) a11yCtx.state.fullyResolved = false;
  const literalIds = idNodes.filter((n) => n.key !== '');

  const route = deriveRoute(pageRel);
  return {
    head: { route, source: 'static', tags: [...composed.values(), ...additiveTags], file: pageRel },
    images: { route, images },
    headings: { route, headings, componentHeadings },
    a11y: {
      route,
      landmarks: representatives(
        a11yNodes.filter((n) => n.kind === 'landmark' && countsAsLandmark(n)),
        chainOrder
      ),
      nestedLandmarks,
      ids: representatives(literalIds, chainOrder),
      // `href="#top"` scrolls to the document top with no element of that id, so it is
      // never a missing reference (HTML's "top of the document" fragment).
      idRefs: a11yNodes
        .filter((n) => n.kind === 'idref' && !(n.attr === 'href' && isTopFragment(n.key)))
        .map((n) => ({ id: n.key, attr: n.attr ?? '', file: n.file, line: n.line })),
      idCandidates: [...new Set([...literalIds.map((n) => n.key), ...(appHtmlIds ?? [])])],
      fullyResolved: a11yCtx.state.fullyResolved
    }
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
  cache: ParseCache = new Map(),
  // The project's compiled `Project.kitAliases` (undefined -> resolveComponentPath's
  // $lib-only default), forwarded to transitive <head>/heading resolution.
  aliases?: readonly KitAlias[],
  // The shell's literal ids (`Project.appHtmlIds`): part of every rendered document, so they
  // satisfy a route's id references.
  appHtmlIds?: readonly string[]
): Promise<{
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  a11y: ResolvedA11y[];
}> {
  const [pages, layouts] = await Promise.all([enumerateRoutePages(rt, cwd), collectLayouts(rt, cwd)]);
  const facts = await Promise.all(
    pages.map((page) => resolveRoute(rt, cwd, page, config, layouts, cache, aliases, appHtmlIds))
  );
  return {
    heads: facts.map((f) => f.head),
    images: facts.map((f) => f.images),
    headings: facts.map((f) => f.headings),
    a11y: facts.map((f) => f.a11y)
  };
}
