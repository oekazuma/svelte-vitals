import { componentRule } from '../component-rule.js';
import { listOption } from '../../rule-options.js';
import { resolveRepoLocalPath } from '../../kit-module-parse.js';
import { routeGlobToRegExp } from '../../config-apply.js';
import type { ComponentFacts } from '../../component.js';
import type { RuleContext } from '../../rule.js';
import type { Project } from '../../types.js';

const ID = 'architecture/route-component-import';

/**
 * Satellite files that legitimately render a route entry by hand: a story renders it to look at,
 * a test renders it to assert on, and both supply what Kit would have supplied.
 *
 * Deliberately NARROW, because a `string-list` option can only widen it. The two failure
 * directions are not symmetric: too narrow gives a false positive the user fixes by appending;
 * too broad gives a missed true positive they cannot fix at all, since nothing removes an entry.
 * Configuring this is therefore an expected step for a project whose satellite convention is its
 * own, not an exceptional one.
 */
const EXEMPT_IMPORTERS = ['**/*.stories.svelte', '**/*.test.svelte', '**/*.spec.svelte'] as const;

const ROUTES_DIR = 'src/routes/';

/**
 * Kit's own route-entry component names. `analyze()` in
 * `@sveltejs/kit/src/core/sync/create_manifest_data/index.js` strips only the component extension
 * and then tests `/^\+(?:(page(?:@(.*))?)|(layout(?:@(.*))?)|(error))$/`, so the `@` breakout
 * suffix is unbounded — a layout name may contain dots, and `[^./]*` would wrongly miss
 * `+page@foo.bar.svelte`.
 */
const ROUTE_ENTRY = /^\+(page|layout)(@.*)?\.svelte$/;

/** Whether a project-relative path is a route entry. Kit gives these names meaning only under the routes directory. */
function isRouteEntry(path: string): boolean {
  if (!path.startsWith(ROUTES_DIR)) return false;
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base === '+error.svelte' || ROUTE_ENTRY.test(base);
}

/** The route entries this component imports, with the line each import sits on. */
function routeEntryImports(c: ComponentFacts, ctx: RuleContext): { line: number; target: string }[] {
  const out: { line: number; target: string }[] = [];
  for (const { source, line, type } of c.importSpans ?? []) {
    if (type) continue; // erased at build: nothing renders, so the harm cannot occur
    const target = resolveRepoLocalPath(source, c.file, ctx.project.kitAliases);
    if (target !== undefined && isRouteEntry(target)) out.push({ line, target });
  }
  return out;
}

/**
 * Per-component memo of `routeEntryImports`, so `applies` and `bad` — which `componentRule`'s
 * harness (`packages/core/src/rules/component-rule.ts`) calls back to back with the exact same
 * `ComponentFacts` object for one component before moving to the next — share one resolution of
 * every import specifier instead of each doing its own. A `WeakMap` lets facts from a finished
 * analysis be collected rather than pinned for the process lifetime.
 *
 * `routeEntryImports` reads exactly three inputs: `c.importSpans`, `c.file`, and
 * `ctx.project.kitAliases`. The first two are the `ComponentFacts` identity, which the `WeakMap`
 * key already covers; the third is not, so it is stored alongside the result and compared by
 * reference on every lookup. Reference equality is correct here, not a shortcut: a collection
 * rebuilds the alias list per analysis, so a new `check()` call brings a new array even when its
 * contents are identical to the last one. Two structurally-equal-but-distinct arrays therefore
 * only cost a recomputation, never a wrong answer — the case this guards against is a *different*
 * alias configuration silently reusing a resolution computed under the old one.
 */
const routeEntryImportsCache = new WeakMap<
  ComponentFacts,
  { aliases: Project['kitAliases']; result: { line: number; target: string }[] }
>();

function cachedRouteEntryImports(c: ComponentFacts, ctx: RuleContext): { line: number; target: string }[] {
  const cached = routeEntryImportsCache.get(c);
  if (cached !== undefined && cached.aliases === ctx.project.kitAliases) return cached.result;
  const result = routeEntryImports(c, ctx);
  routeEntryImportsCache.set(c, { aliases: ctx.project.kitAliases, result });
  return result;
}

export const architectureRouteComponentImport = componentRule({
  id: ID,
  title: 'Route component import',
  category: 'architecture',
  severity: 'info',
  label: 'Route component imports',
  options: { exemptImporters: { kind: 'string-list', default: EXEMPT_IMPORTERS } },
  recommendation:
    'Extract the shared markup into a component under $lib and import that from both places, leaving the route entry to SvelteKit.',
  rationale:
    'A route entry is written on the assumption that SvelteKit renders it: Kit hands a page its data and params, and an error page its page.error and page.status. Imported from somewhere else it receives none of that and renders against nothing, or against the importing page data standing in for its own.',
  // Signal present = this file imports a route entry, exempt or not. An exempt file therefore
  // reaches `bad` and earns a PASS, rather than being called signal-free.
  applies: (c, o, ctx) => cachedRouteEntryImports(c, ctx).length > 0,
  bad: (c, o, ctx) => {
    const exempt = listOption(o, 'exemptImporters').map(routeGlobToRegExp);
    if (exempt.some((re) => re.test(c.file))) return [];
    return cachedRouteEntryImports(c, ctx).map(({ line, target }) => ({
      line,
      message: `${target} is a SvelteKit route entry — imported here it renders without the data Kit would give it`
    }));
  }
});
