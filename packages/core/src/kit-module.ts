import type { SuppressionDirective } from './component.js';

/**
 * Facts parsed from one SvelteKit route/hooks file for the SSR shared-state rules
 * (SEC003–005). Collected by `collectKitModuleFacts` (static/CLI + vite build mode).
 */
export interface KitModuleFacts {
  /** Repo-relative source file. */
  file: string;
  /** 'server' = runs only on the server (+*.server, +server, hooks.server); 'universal' = +page.ts/+layout.ts (still runs on the server during SSR). */
  kind: 'server' | 'universal';
  /** Module-scope let/var reassigned from inside a function (SEC004). */
  moduleStateReassignments: { name: string; line: number; inHandler: boolean }[];
  /** Writes to an imported binding from inside an exported handler (SEC003). */
  importedStateWrites: { name: string; line: number; via: 'assignment' | 'set-call' }[];
  /** Writes to an imported binding outside handlers — top level or helper functions (SEC005's write flavour). */
  importedStateWritesOutsideHandlers: { name: string; line: number }[];
  /** Value imports whose specifier resolves to a repo-local `.svelte.ts`/`.svelte.js` runes module (SEC005). */
  runesModuleImports: { source: string; resolved: string; names: string[]; line: number }[];
  /** Svelte lifecycle/context calls that run outside component initialisation — top level, handler bodies, or the `init` hook (CORRECT007). */
  lifecycleCalls: {
    name: string;
    line: number;
    inHandler: boolean;
  }[];
  /** Browser-global reads in server-executed positions — top level, handler bodies, the `init` hook (CORRECT008). Empty when the file itself exports `ssr = false`. */
  browserGlobalRefs: {
    name: string;
    line: number;
    inHandler: boolean;
  }[];
  /** Set when this file disables SSR via `export const ssr = false` (inline or same-file alias export) — the declaration's line (SEO031). */
  ssrDisabled?: { line: number };
  /** Inline `svelte-vitals-disable-next-line` directives in this file. */
  suppressions: SuppressionDirective[];
}
