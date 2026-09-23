import type { BasePathLinkFact, SuppressionDirective } from './component.js';

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
  /** Set when this file exports `ssr` as anything but a literal `false` (`true`, a computed value, a re-export) — it may turn SSR back on under a root layout's `ssr = false` (see `appSsrDisabled`). */
  ssrEnabled?: true;
  /** Set when this file disables client-side rendering via `export const csr = false` (inline or same-file alias export). With no client runtime, a universal load only runs during SSR — performance/load-waterfall's browser-waterfall premise doesn't hold. */
  csrDisabled?: { line: number };
  /** Set when the exported `load` redirects on every call — a top-level `redirect()` / `throw redirect()` statement no earlier `return` can skip. A `+page` module carrying it means the route never renders a document of its own. */
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

/** Whether a universal `+page`/`+layout` module never runs on the server — its own `ssr = false` or an app-wide one. */
export function universalNeverSsr(m: KitModuleFacts, kitModules: readonly KitModuleFacts[] | undefined): boolean {
  return m.kind === 'universal' && (m.ssrDisabled !== undefined || appSsrDisabled(kitModules));
}
