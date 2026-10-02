import type { Config } from '@svelte-vitals/core';
import type {
  A11yOccurrenceInfo,
  A11ySkipCause,
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
import type { A11yNode, ChildrenSite, ParsedFile, ParsedTag } from './parse.js';
import { commonPrefix, decidedArms, flagArms } from './parse.js';
import { urlHolds, type UrlCond } from './url-cond.js';
import { enumerateRoutePages } from './project.js';
import {
  nestHeading,
  offsetPath,
  resolveComponentFiles,
  resolveFileTags,
  readAndParse,
  falseImports,
  BROAD_KINDS,
  tagKey,
  type ParseCache,
  type ResolveCtx
} from './resolve.js';

const ROUTES_DIR = 'src/routes';
const MAX_DEPTH = 5;

/** Runtime.glob returns POSIX-separated paths on every platform, so we split on '/'. */
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
  /** Why fullyResolved went false, one entry per offending location — deduped and emitted at route level. */
  causes: A11ySkipCause[];
  /** Body tag names seen so far across the composition (a11y/required-element's presence set). */
  elementTags: Set<string>;
  /** Closed world for elements: every component descended into, no `{@html}`, no `<svelte:element>`. */
  elementsClosed: boolean;
}

interface ComposeCtx extends ResolveCtx {
  state: ComposeState;
}

/** Group ids a file occupies, so the next file instance can start above them. */
function groupSpan(a11y: ParsedFile['a11y']): number {
  let max = -1;
  for (const path of [...a11y.nodes.map((n) => n.path), ...(a11y.slotPaths ?? [])]) {
    for (const step of path) if (step.group > max) max = step.group;
  }
  return max + 1;
}

/** Route-level dedupe: one cause per (kind, file, detail), first occurrence wins. */
function dedupeCauses(causes: A11ySkipCause[]): A11ySkipCause[] {
  const seen = new Map<string, A11ySkipCause>();
  for (const c of causes) {
    const key = `${c.kind}::${c.file}::${c.detail ?? ''}`;
    if (!seen.has(key)) seen.set(key, c);
  }
  return [...seen.values()];
}

/**
 * A server-rendered tag is never overridden by a client-only one: on a server-rendered route the
 * client-only tag is dropped later (collect-all), and the one it overrode must still be there.
 */
function serverRendered(tag: HeadTag | undefined): boolean {
  return tag !== undefined && !tag.clientOnly;
}

/** Every robots meta renders and crawlers obey the most restrictive one, so none may override another. */
function isRobotsMeta(tag: { kind: string; name?: string }): boolean {
  return tag.kind === 'meta' && tag.name === 'robots';
}

/**
 * One file's contribution to the route: its own occurrences plus, inline at each component
 * usage, that component's contribution carrying the usage's branch address and repeatability.
 * Anything that cannot be followed (package/adapter import, an unresolvable dynamic component,
 * a cycle, MAX_DEPTH) contributes nothing and opens the world — existential rules stay sound,
 * `no-missing-id-ref` skips the route. A tag that may render one of several components composes
 * each as an arm of one exclusive block.
 */
async function composeA11y(
  ctx: ComposeCtx,
  fileRel: string,
  parsed: ParsedFile,
  depth: number,
  visited: Set<string>,
  chain: boolean,
  // The use's decisions on this file's prop-gated `{#if}` groups: true keeps the first arm only.
  decided?: ReadonlyMap<number, boolean>
): Promise<ComposedNode[]> {
  const { rt, cwd, state } = ctx;
  if (parsed.a11y.unknowable.length > 0) {
    state.fullyResolved = false;
    for (const u of parsed.a11y.unknowable) state.causes.push({ ...u, file: fileRel });
  }
  for (const t of parsed.a11y.elementTags) state.elementTags.add(t);
  if (parsed.a11y.elementsUnknowable) state.elementsClosed = false;
  const base = state.nextGroup;
  state.nextGroup += groupSpan(parsed.a11y);

  const composed: ComposedNode[] = [];
  for (const node of parsed.a11y.nodes) {
    if (decided && ruledOut(node.path, decided)) continue;
    const path = offsetPath(node.path, base);
    if (node.kind !== 'component') {
      composed.push({ ...node, path, file: fileRel, chain });
      continue;
    }
    // Package (incl. adapter) imports and `<svelte:self>` resolve to no repo-local file.
    const found = depth > 0 ? await resolveComponentFiles(ctx, node.key, parsed, fileRel) : undefined;
    const files = found?.files.filter((f) => !visited.has(f)) ?? [];
    if (!found?.complete || files.length < found.files.length) {
      state.fullyResolved = false;
      state.causes.push({ kind: 'component', detail: node.key, file: fileRel, line: node.line });
      // A cycle-cut (`visited`) hides no tag — that file's tags are already in the union — but this
      // branch is shared with the cases that do (unresolved, truncated), and it stays conservative.
      state.elementsClosed = false;
    }
    const group = files.length > 1 ? state.nextGroup++ : undefined;
    for (const [branch, childRel] of files.entries()) {
      const childParsed = await readAndParse(rt, cwd, childRel, ctx.cache);
      const gates = childParsed.a11y.gates;
      const childDecided =
        gates && node.attributes ? decidedArms(childParsed, node.attributes, gates, node.snippets) : undefined;
      const child = await composeA11y(
        ctx,
        childRel,
        childParsed,
        depth - 1,
        new Set(visited).add(childRel),
        false,
        childDecided
      );
      const at = group === undefined ? path : [...path, { group, branch }];
      for (const inner of child) {
        composed.push({ ...inner, path: [...at, ...inner.path], repeatable: node.repeatable || inner.repeatable });
      }
    }
  }
  return composed;
}

/** Whether `path` runs through an arm `decided` (see `decidedArms`) rules out. */
function ruledOut(path: readonly BranchStep[], decided: ReadonlyMap<number, boolean>): boolean {
  return path.some((s) => decided.has(s.group) && (decided.get(s.group) ? s.branch !== 0 : s.branch === 0));
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
  appHtmlIds: readonly { id: string; line: number }[] | undefined,
  appHtmlBodyTags: readonly string[] | undefined,
  appHtmlHeadTags: readonly ParsedTag[] | undefined,
  headAliases: readonly KitAlias[] | undefined
): Promise<RouteFacts> {
  const files = chainFiles(pageRel, layouts);
  const chainOrder = new Map(files.map((f, i) => [f.rel, i]));
  // A layout's children render only in the arms whose request-path test this route can satisfy.
  const routePath = deriveRoute(pageRel);
  // `page.route.id` keeps the `(group)` segments the path drops.
  const routeId = '/' + dirSegments(dirOf(pageRel)).join('/');
  const onRoute = (url: UrlCond | undefined) => urlHolds(url, routePath, routeId) !== false;
  // The `{#if}` groups whose first test this route's path or id decides, as `decidedArms` reads them.
  const urlArms = (gates: ReadonlyMap<number, UrlCond> | undefined): Map<number, boolean> => {
    const out = new Map<number, boolean>();
    for (const [group, cond] of gates ?? []) {
      const holds = urlHolds(cond, routePath, routeId);
      if (holds !== undefined) out.set(group, holds);
    }
    return out;
  };
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
  // Keyed by origin too: a client-only dynamic key is dropped on server-rendered routes like any
  // client-only tag, and must not stand in for a server-rendered one.
  const noKeys = () => ({ name: false, property: false });
  const dynamicKeys = {
    own: { server: noKeys(), client: noKeys() },
    inherited: { server: noKeys(), client: noKeys() }
  };
  const images: ImageInfo[] = [];
  let imagesAt = 0;
  const headings: HeadingInfo[] = [];
  const componentHeadings: HeadingInfo[] = [];
  let dynamicHeading = false;
  let clientOnlyHeading = false;
  // Heading paths are route-wide: each chain file gets its own group range, and a file renders
  // below its parent layout's `{@render children()}` arm.
  let headingGroup = 0;
  // Where the layouts above render their children, one per place (see `slotPrefixes`): the branch
  // path, and the document-order offsets that place a heading there (`HeadingInfo.order`).
  let childrenAts: { path: BranchStep[]; order: number[] }[] = [{ path: [], order: [] }];
  const placeHeading = (h: HeadingInfo, at: (typeof childrenAts)[number]): HeadingInfo => {
    const nested = nestHeading(h, at.path, headingGroup);
    return { ...nested, order: [...at.order, ...(nested.order ?? [])] };
  };
  const a11yCtx: ComposeCtx = {
    rt,
    cwd,
    cache,
    aliases,
    state: {
      nextGroup: 0,
      fullyResolved: true,
      causes: [],
      elementTags: new Set(appHtmlBodyTags ?? []),
      elementsClosed: true
    }
  };
  const a11yNodes: ComposedNode[] = [];
  const nestedLandmarks: ResolvedA11y['nestedLandmarks'] = [];
  /** Landmark the layouts above the current chain file render their children inside. */
  let slotLandmark: string | undefined;
  /** Branch addresses the layouts above the current chain file render their children at, one per position. */
  let slotPrefixes: BranchStep[][] = [[]];

  // Set once a layout renders its children only in arms an imported `false` flag rules out: the rest
  // of the chain renders no body. Its head still counts, as the route is judged on the shell it serves.
  let unreached = false;
  for (const { rel, isPage } of files) {
    const parsed = await readAndParse(rt, cwd, rel, cache);
    const flagGates = [...(parsed.a11y.flagGates?.values() ?? []), ...(parsed.headingFlagGates?.values() ?? [])];
    const falses =
      flagGates.length > 0 && !unreached
        ? await falseImports(
            a11yCtx,
            rel,
            parsed,
            flagGates.map((g) => g.name)
          )
        : new Set<string>();
    const a11yFlags = flagArms(parsed.a11y.flagGates, falses);
    const headingFlags = flagArms(parsed.headingFlagGates, falses);
    const a11yDecided = new Map([...urlArms(parsed.a11y.urlGates), ...a11yFlags]);
    const headingDecided = new Map([...urlArms(parsed.headingUrlGates), ...headingFlags]);
    const open = (path: readonly BranchStep[] | undefined) => !path || !ruledOut(path, headingDecided);

    const base = a11yCtx.state.nextGroup;
    const contributed = unreached
      ? []
      : await composeA11y(a11yCtx, rel, parsed, MAX_DEPTH, new Set([rel]), true, a11yDecided);
    // The layout's main/aside is this file's sectioning ancestor, so a <header>/<footer> here is no
    // landmark (HTML-AAM) — for any rule, not just nesting — nor the landmark its content sits in.
    const scoped = slotLandmark === 'main' || slotLandmark === 'complementary';
    for (const node of contributed) {
      if (node.topLevel && scoped) node.topLevel = false;
      if (!node.chain || node.kind !== 'landmark' || !countsAsLandmark(node) || node.repeatable) continue;
      const within = (scoped ? node.inFixedLandmark : node.inLandmark) ?? slotLandmark;
      if (within) nestedLandmarks.push({ kind: node.key, within, file: node.file, line: node.line });
    }
    // Rendered at each of the layouts' positions, which exclude each other when they sit in the arms
    // of one block: the fold then counts the file once, where the other arms' content is not.
    for (const prefix of slotPrefixes)
      a11yNodes.push(
        ...contributed.map((node) => (prefix.length > 0 ? { ...node, path: [...prefix, ...node.path] } : node))
      );
    const kept =
      parsed.a11y.slotPaths?.flatMap((p, i) =>
        onRoute(parsed.a11y.slotUrls?.[i]) && !ruledOut(p, a11yFlags) ? [i] : []
      ) ?? [];
    // The landmark the page sits in is the first one around a place this route renders it at.
    const around = parsed.a11y.slotLandmarks?.filter((_, i) => kept.includes(i)).find((l) => l.landmark);
    const slotIn =
      parsed.a11y.slotLandmarks && kept.length > 0
        ? scoped
          ? around?.fixed
          : around?.landmark
        : scoped
          ? parsed.a11y.slotInFixedLandmark
          : parsed.a11y.slotInLandmark;
    slotLandmark = slotIn ?? slotLandmark;
    const slotPaths = parsed.a11y.slotPaths?.filter((_, i) => kept.includes(i));
    const slots = exclusiveSites(slotPaths?.length ? slotPaths : parsed.a11y.slotPaths)?.map((p) =>
      offsetPath(p, base)
    );
    if (slots) {
      const next = slotPrefixes.flatMap((prefix) => slots.map((slot) => [...prefix, ...slot]));
      // ponytail: positions multiply down the chain; past a handful, place the rest where they all agree.
      slotPrefixes = next.length <= 8 ? next : [next.reduce(commonPrefix)];
    }

    // A layout's images after its `{@render children()}` come after the page's in document order.
    const own = unreached ? [] : parsed.images.map((img) => ({ ...img, file: rel }));
    images.splice(imagesAt, 0, ...own);
    imagesAt += parsed.imagesBeforeChildren ?? own.length;
    const resolved = await resolveFileTags(rt, cwd, rel, parsed, config, MAX_DEPTH, new Set([rel]), cache, headAliases);
    for (const heading of unreached ? [] : resolved.ownHeadings.filter((h) => open(h.path))) {
      for (const at of childrenAts) headings.push(placeHeading(heading, at));
    }
    dynamicHeading = dynamicHeading || (!unreached && parsed.dynamicHeading);

    for (const tag of resolved.tags) {
      if (tag.dynamicKey) {
        const seen = dynamicKeys[isPage ? 'own' : 'inherited'][tag.clientOnly ? 'client' : 'server'];
        seen.name ||= tag.dynamicKey.name;
        seen.property ||= tag.dynamicKey.property;
        continue;
      }
      const stamped: HeadTag = { ...tag, presence: isPage ? 'own' : 'inherited', file: rel };
      if (
        tag.kind === 'jsonld' ||
        tag.kind === 'script' ||
        (tag.kind === 'link' && tag.rel !== 'canonical') ||
        isRobotsMeta(tag)
      )
        additiveTags.push(stamped);
      else if (!(stamped.clientOnly && serverRendered(composed.get(tagKey(tag))))) composed.set(tagKey(tag), stamped);
    }
    if (resolved.broad) {
      if (isPage) broadOwn = true;
      else broadInherited = true;
    }
    if (!unreached) {
      const shown = resolved.headings.filter((h) => open(h.path));
      for (const at of childrenAts) componentHeadings.push(...shown.map((h) => placeHeading(h, at)));
      dynamicHeading = dynamicHeading || resolved.dynamicHeading;
      clientOnlyHeading = clientOnlyHeading || resolved.clientOnlyHeading;
    }
    const childrenPath = resolved.renderPaths.get('children');
    const childrenOffset = resolved.renderOffsets.get('children');
    const reachable = resolved.childrenSites?.filter((s) => onRoute(s.url) && open(s.path));
    const placed = reachable?.length ? reachable : resolved.childrenSites;
    const exclusive = exclusiveSites(placed?.map((s) => s.path));
    const sites: ChildrenSite[] | undefined =
      placed?.length === 1
        ? placed
        : exclusive && exclusive.length > 1
          ? placed
          : childrenPath && childrenOffset !== undefined
            ? [{ path: exclusive?.[0] ?? childrenPath, offset: childrenOffset }]
            : undefined;
    if (sites) {
      const next = childrenAts.flatMap((at) =>
        sites.map((site) => ({
          path: [...at.path, ...offsetPath(site.path, headingGroup)],
          order: [...at.order, site.offset]
        }))
      );
      childrenAts =
        next.length <= 8 ? next : [{ path: next.map((n) => n.path).reduce(commonPrefix), order: next[0]!.order }];
    }
    headingGroup += resolved.groupSpan;
    if (a11yFlags.size > 0 && parsed.a11y.slotPaths?.every((p) => ruledOut(p, a11yFlags))) unreached = true;
  }

  // Broad (opaque) meta source: fill only kinds not already set specifically.
  if (broadOwn || broadInherited) {
    const presence = broadOwn ? 'own' : 'inherited';
    for (const tag of BROAD_KINDS) {
      const key = tagKey(tag);
      if (!serverRendered(composed.get(key))) composed.set(key, { ...tag, presence });
    }
  }
  // A <meta> with a dynamic key may be any meta of that attribute: the same fill, limited to it.
  for (const presence of ['own', 'inherited'] as const) {
    for (const origin of ['server', 'client'] as const) {
      const { name, property } = dynamicKeys[presence][origin];
      for (const tag of BROAD_KINDS) {
        // X reads twitter:card from property= too.
        const couldBe = (name && tag.name) || (property && (tag.property || tag.name === 'twitter:card'));
        const key = tagKey(tag);
        if (!couldBe) continue;
        if (origin === 'server' && !serverRendered(composed.get(key))) composed.set(key, { ...tag, presence });
        else if (origin === 'client' && !composed.has(key)) composed.set(key, { ...tag, presence, clientOnly: true });
      }
    }
  }
  // After the broad fill: an opaque meta component may override the shell's literal.
  for (const tag of appHtmlHeadTags ?? []) {
    const stamped: HeadTag = { ...tag, presence: 'inherited', file: 'src/app.html' };
    if (isRobotsMeta(tag)) additiveTags.push(stamped);
    else if (!serverRendered(composed.get(tagKey(tag)))) composed.set(tagKey(tag), stamped);
  }

  const idNodes = a11yNodes.filter((n) => n.kind === 'id');
  // An expression-valued id (key '') is unknowable: it closes no world and is no candidate.
  for (const n of idNodes) {
    if (n.key !== '') continue;
    a11yCtx.state.fullyResolved = false;
    a11yCtx.state.causes.push({ kind: 'dynamic-id', file: n.file, line: n.line });
  }
  const literalIds = idNodes.filter((n) => n.key !== '');

  const ids = representatives(literalIds, chainOrder);
  // Shell collision: the app.html occurrence is prepended as the always-first, never-penalized
  // representative — sorted in, representativeOrder would rank it after chain files and invert
  // the penalty. Iterate the folded map's own keys (never index by shell id: a shell
  // id="constructor" would read Object.prototype).
  if (appHtmlIds) {
    const shell = new Map(appHtmlIds.map((s) => [s.id, s.line]));
    for (const key of Object.keys(ids)) {
      const line = shell.get(key);
      if (line !== undefined) ids[key] = [{ file: 'src/app.html', line }, ...ids[key]!];
    }
  }

  const route = deriveRoute(pageRel);
  return {
    head: { route, source: 'static', tags: [...composed.values(), ...additiveTags], file: pageRel },
    images: { route, images },
    headings: {
      route,
      headings,
      componentHeadings,
      ...(dynamicHeading ? { dynamicHeading: true } : {}),
      ...(clientOnlyHeading ? { clientOnlyHeading: true } : {})
    },
    a11y: {
      route,
      landmarks: representatives(
        a11yNodes.filter((n) => n.kind === 'landmark' && countsAsLandmark(n)),
        chainOrder
      ),
      nestedLandmarks,
      ids,
      // `href="#top"` scrolls to the document top with no element of that id, so it is
      // never a missing reference (HTML's "top of the document" fragment).
      idRefs: a11yNodes
        .filter((n) => n.kind === 'idref' && !(n.attr === 'href' && isTopFragment(n.key)))
        .map((n) => ({ id: n.key, attr: n.attr ?? '', file: n.file, line: n.line })),
      idCandidates: [...new Set([...literalIds.map((n) => n.key), ...(appHtmlIds ?? []).map((s) => s.id)])],
      fullyResolved: a11yCtx.state.fullyResolved,
      ...(a11yCtx.state.causes.length > 0 ? { unresolvedCauses: dedupeCauses(a11yCtx.state.causes) } : {}),
      elementTags: [...a11yCtx.state.elementTags],
      elementsClosed: a11yCtx.state.elementsClosed,
      file: pageRel
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
  // The project's compiled `Project.kitAliases` (undefined -> the `$lib`-only default),
  // forwarded to transitive <head>/heading resolution.
  aliases?: readonly KitAlias[],
  // The shell's literal ids (`Project.appHtmlIds`): part of every rendered document, so they
  // satisfy a route's id references.
  appHtmlIds?: readonly { id: string; line: number }[],
  // The shell's `<body>` tag names (`Project.appHtmlBodyTags`): present on every route.
  appHtmlBodyTags?: readonly string[],
  // The shell's literal head tags (`Project.appHtmlHeadTags`): every route's lowest-priority tags.
  appHtmlHeadTags?: readonly ParsedTag[],
  // `Project.headAliases`: `aliases` plus installed packages, for the <head>/heading walk only.
  headAliases: readonly KitAlias[] | undefined = aliases
): Promise<{
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  a11y: ResolvedA11y[];
  /** Every `+page`/`+layout` `.svelte` file, for resolving which routes are server-rendered. */
  routeFiles: string[];
}> {
  const [pages, layouts] = await Promise.all([enumerateRoutePages(rt, cwd), collectLayouts(rt, cwd)]);
  const facts = await Promise.all(
    pages.map((page) =>
      resolveRoute(
        rt,
        cwd,
        page,
        config,
        layouts,
        cache,
        aliases,
        appHtmlIds,
        appHtmlBodyTags,
        appHtmlHeadTags,
        headAliases
      )
    )
  );
  return {
    heads: facts.map((f) => f.head),
    images: facts.map((f) => f.images),
    headings: facts.map((f) => f.headings),
    a11y: facts.map((f) => f.a11y),
    routeFiles: [...pages, ...layouts.values()]
  };
}

/**
 * The places a layout renders its children, when every two of them sit in different arms of one
 * block: one of them renders at a time, so the page is placed in each. Otherwise (a place outside
 * any such pair, as with two separate `{#if}`s) the page stays where all of them agree.
 */
function exclusiveSites(sites: BranchStep[][] | undefined): BranchStep[][] | undefined {
  if (!sites) return undefined;
  if (sites.length < 2) return sites;
  const apart = (a: BranchStep[], b: BranchStep[]) =>
    a.some((s) => b.some((t) => s.group === t.group && s.branch !== t.branch));
  return sites.every((a, i) => sites.every((b, j) => i === j || apart(a, b))) ? sites : [sites.reduce(commonPrefix)];
}
