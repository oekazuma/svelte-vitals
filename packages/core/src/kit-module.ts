import type { BasePathLinkFact, SuppressionDirective } from './component.js';
import type { RuleContext } from './rule.js';

/**
 * Facts parsed from one SvelteKit route/hooks file for the SSR shared-state rules
 * (the security kit-module rules). Collected by `collectKitModuleFacts` (static/CLI + vite build mode).
 */
export interface KitModuleFacts {
  /** Repo-relative source file. */
  file: string;
  /** 'server' = runs only on the server (+*.server, +server, hooks.server); 'universal' = +page.ts/+layout.ts (still runs on the server during SSR). */
  kind: 'server' | 'universal';
  /** Module-scope let/var reassigned from inside a function (security/server-module-state). */
  moduleStateReassignments: { name: string; line: number; inHandler: boolean }[];
  /** Writes to an imported binding from inside an exported handler (security/handler-state-write). */
  importedStateWrites: { name: string; line: number; via: 'assignment' | 'set-call' }[];
  /** Writes to an imported binding outside handlers — top level or helper functions (security/shared-state-import's write flavour). */
  importedStateWritesOutsideHandlers: { name: string; line: number }[];
  /**
   * `.set()`/`.update()` in a handler on an import resolving under the `$lib` server root.
   * The call shape alone cannot tell a persistence client (`db.set(…)`) from a hand-rolled
   * in-memory store, so the decision needs the target module — which this pure parse cannot
   * read. `collectKitModuleFacts` resolves each one and promotes the in-memory ones into
   * `importedStateWrites`; a consumer that ignores this field sees the pre-arbitration
   * behaviour, i.e. every one of these exempt.
   */
  pendingServerStoreWrites: { name: string; imported: string; resolved: string; line: number }[];
  /** Value imports whose specifier resolves to a repo-local `.svelte.ts`/`.svelte.js` runes module (security/shared-state-import). */
  runesModuleImports: { source: string; resolved: string; names: string[]; line: number }[];
  /** Svelte lifecycle/context calls that run outside component initialisation — top level, handler bodies, or the `init` hook (correctness/orphan-lifecycle). */
  lifecycleCalls: {
    name: string;
    line: number;
    inHandler: boolean;
  }[];
  /** Browser-global reads in server-executed positions — top level, handler bodies, the `init` hook (correctness/server-browser-global). Empty when the file itself exports `ssr = false`. */
  browserGlobalRefs: {
    name: string;
    line: number;
    inHandler: boolean;
  }[];
  /** Root-relative `redirect()` literals in this Kit module (correctness/base-path-navigation). */
  basePathLinks: BasePathLinkFact[];
  /** Set when this file disables SSR via `export const ssr = false` (inline or same-file alias export) — the declaration's line (seo/ssr-disabled). */
  ssrDisabled?: { line: number };
  /** Set when this file exports `ssr` as anything but a literal `false` (`true`, a computed value, a re-export) — it may turn SSR back on under a layout's `ssr = false` (see `appSsrDisabled`, `routeNeverSsr`). */
  ssrEnabled?: true;
  /** Set when this file disables client-side rendering via `export const csr = false` (inline or same-file alias export). With no client runtime, a universal load only runs during SSR — performance/load-waterfall's browser-waterfall premise doesn't hold. */
  csrDisabled?: { line: number };
  /** Set when the exported `load` redirects on every call — every path through its body reaches a `redirect()` before any `return` (see `loadAlwaysRedirects` in kit-module-parse.ts). A `+page` module carrying it means the route never renders a document of its own. */
  loadAlwaysRedirects?: true;
  /** Sequential-await analysis of the exported `load` function (performance/load-waterfall, performance/sequential-awaits): 1-based lines of await sites that depend on an earlier await's result, and of sites independent of all earlier awaits. Set only when at least one list is non-empty. */
  loadWaterfalls?: { dependentLines: number[]; independentLines: number[] };
  /** Inline `svelte-vitals-disable-next-line` directives in this file. */
  suppressions: SuppressionDirective[];
  /** Set when the file failed to read or parse and these facts are the empty fallback — the file was NOT analyzed. */
  parseFailed?: true;
  /** Set when the file could not be READ — an environment problem, not a malformed module. */
  readFailed?: true;
}

/** The root layout — its page options cover the whole app. */
export const ROOT_LAYOUT_RE = /^src\/routes\/\+layout(\.server)?\.(ts|js)$/;

/** Files whose `ssr` export is a page option — it has no effect in `+server` endpoints or hooks files. */
export const PAGE_OPTION_FILE_RE = /\+(page|layout)(\.server)?\.(ts|js)$/;

const appSsrCache = new WeakMap<readonly KitModuleFacts[], boolean>();

/**
 * Whether no page is ever server-rendered: the root layout exports `ssr = false` and no page-option
 * file might turn it back on. Universal loads and components then run only in the browser; server
 * files (`+page.server`, `+server`, hooks) still run on the server.
 */
export function appSsrDisabled(kitModules: readonly KitModuleFacts[] | undefined): boolean {
  if (!kitModules) return false;
  let hit = appSsrCache.get(kitModules);
  if (hit === undefined) {
    hit =
      kitModules.some((m) => m.ssrDisabled && ROOT_LAYOUT_RE.test(m.file)) &&
      !kitModules.some((m) => PAGE_OPTION_FILE_RE.test(m.file) && (m.ssrEnabled || m.parseFailed));
    appSsrCache.set(kitModules, hit);
  }
  return hit;
}

/** The rule-context fields the per-route SSR resolution reads. */
export type SsrScope = Pick<RuleContext, 'kitModules' | 'components' | 'sourceFiles'>;

const ROUTES_DIR = 'src/routes';
/** A `+page`/`+layout` file: its directory, kind, and the `@segment` layout reset (on `.svelte` names). */
const ROUTE_FILE_RE = /^(src\/routes(?:\/.+)?)\/\+(page|layout)(?:@([^/]*))?(?:\.server)?\.(?:svelte|ts|js)$/;

const parentDir = (dir: string): string | undefined =>
  dir === ROUTES_DIR ? undefined : dir.slice(0, dir.lastIndexOf('/'));

/** The nearest ancestor-or-self directory a `@segment` reset names (`''` is the root). */
function resetTarget(dir: string | undefined, segment: string): string | undefined {
  for (let d = dir; d !== undefined; d = parentDir(d)) {
    if (segment === '' ? d === ROUTES_DIR : d.slice(d.lastIndexOf('/') + 1) === segment) return d;
  }
  return undefined;
}

const routeSsrCache = new WeakMap<readonly KitModuleFacts[], Map<string, boolean>>();

/**
 * Per route directory, whether its page (`page:<dir>`) or layout (`layout:<dir>`) is never
 * server-rendered. A page takes the nearest `ssr` export along its own files and then its layout
 * chain, following `+page@x`/`+layout@x` resets as SvelteKit does; an export other than a literal
 * `false`, or an unparsed option file, counts as SSR on. A layout is off only when every page using
 * it is — and the root layout also needs its own `ssr = false`, since it wraps the 404 page.
 */
function routeSsrOff(scope: SsrScope): Map<string, boolean> {
  const kitModules = scope.kitModules ?? [];
  let hit = routeSsrCache.get(kitModules);
  if (hit) return hit;
  const pages = new Map<string, string | undefined>();
  const layouts = new Map<string, string | undefined>();
  const files = [
    ...(scope.sourceFiles ?? []),
    ...(scope.components ?? []).map((c) => c.file),
    ...kitModules.map((m) => m.file)
  ];
  for (const file of files) {
    const match = ROUTE_FILE_RE.exec(file);
    if (!match) continue;
    const map = match[2] === 'page' ? pages : layouts;
    if (match[3] !== undefined || !map.has(match[1]!)) map.set(match[1]!, match[3]);
  }
  const option = new Map<string, 'on' | 'off'>();
  for (const m of kitModules) {
    const match = ROUTE_FILE_RE.exec(m.file);
    if (!match) continue;
    const key = `${match[2]}:${match[1]}`;
    if (m.ssrEnabled || m.parseFailed) option.set(key, 'on');
    else if (m.ssrDisabled && !option.has(key)) option.set(key, 'off');
  }
  hit = new Map();
  for (const [dir, reset] of pages) {
    const chain: string[] = [];
    for (let d = reset === undefined ? dir : resetTarget(dir, reset); d !== undefined;) {
      const layoutReset = layouts.get(d);
      if (layouts.has(d)) chain.push(d);
      d = layoutReset === undefined ? parentDir(d) : resetTarget(parentDir(d), layoutReset);
    }
    const nearest = [`page:${dir}`, ...chain.map((l) => `layout:${l}`)].map((k) => option.get(k)).find(Boolean);
    const off = nearest === 'off';
    hit.set(`page:${dir}`, off);
    for (const l of chain) hit.set(`layout:${l}`, (hit.get(`layout:${l}`) ?? true) && off);
  }
  if (option.get(`layout:${ROUTES_DIR}`) !== 'off') hit.delete(`layout:${ROUTES_DIR}`);
  routeSsrCache.set(kitModules, hit);
  return hit;
}

/** Whether a `+page`/`+layout` file (module or component) belongs to a route that is never server-rendered. */
export function routeNeverSsr(file: string, scope: SsrScope): boolean {
  const match = ROUTE_FILE_RE.exec(file);
  return !!match && routeSsrOff(scope).get(`${match[2]}:${match[1]}`) === true;
}

/** Whether a universal `+page`/`+layout` module never runs on the server — its own `ssr = false`, an app-wide one, or one its route inherits. */
export function universalNeverSsr(m: KitModuleFacts, scope: SsrScope): boolean {
  return (
    m.kind === 'universal' &&
    (m.ssrDisabled !== undefined || appSsrDisabled(scope.kitModules) || routeNeverSsr(m.file, scope))
  );
}
