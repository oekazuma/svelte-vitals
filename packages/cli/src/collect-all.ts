import { type Config } from '@svelte-vitals/core';
import {
  collectComponentFacts,
  collectKitModuleFacts,
  collectSourceFiles,
  type ComponentFacts,
  type DirectiveIndex,
  type KitModuleFacts,
  type Project,
  type ResolvedA11y,
  type ResolvedHead,
  type ResolvedHeadings,
  type ResolvedImages,
  type Runtime,
  type SuppressionDirective
} from '@svelte-vitals/core/internal';
import { collectProjectFacts } from './providers/source/project.js';
import type { ParseCache } from './providers/source/resolve.js';
import { collectRoutes } from './providers/source/routes.js';
import { routeMatcher } from './route-matcher.js';

/** Everything the rule engine needs about a project, gathered through the Runtime. */
interface CollectedFacts {
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  a11y: ResolvedA11y[];
  project: Project;
  components: ComponentFacts[];
  kitModules: KitModuleFacts[];
  /** `undefined` (not `[]`) for a route-filtered run — see the comment at the call site. */
  sourceFiles: string[] | undefined;
  directives: DirectiveIndex;
}

interface CollectAllOptions {
  /** Restrict route-scoped facts to routes matching this glob. */
  route?: string;
  /** Reuse a parse cache across calls (the vite dev dashboard passes a long-lived one). */
  parseCache?: ParseCache;
}

/**
 * The whole I/O phase of an analysis: every Runtime call made to gather rule input
 * goes through here. Validation (`detectProject`, `checkVersionFloor`) deliberately
 * stays in `analyzeProject` — it has its own error semantics (ProjectError → exit 2)
 * and is per-run, not per-file.
 *
 * Kept as one function so `test/io-budget.test.ts` can hold the REAL pipeline to a
 * fixed I/O budget: a collector added here falls under the read and glob budgets
 * automatically. One exception — a collector skipped when `route` is set must also
 * be added to the route-filtered test's expected list, which is why that test pins
 * the skipped patterns. See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
export async function collectAll(
  rt: Runtime,
  cwd: string,
  config: Config,
  opts: CollectAllOptions = {}
): Promise<CollectedFacts> {
  const matches = routeMatcher(opts.route);
  const parseCache = opts.parseCache ?? new Map();
  // project is resolved first: collectKitModuleFacts needs project.kitAliases, so
  // everything else that's independent of it runs alongside it in one Promise.all.
  const project = await collectProjectFacts(rt, cwd);
  const [collected, components, kitModules, sourceFiles] = await Promise.all([
    collectRoutes(rt, cwd, config, parseCache, project.kitAliases, project.appHtmlIds),
    // Component (Correctness) facts are file-scoped with no route attribution yet, so a
    // route-filtered run skips them rather than reporting unrelated components (#68 review);
    // kitModules is skipped for the same reason.
    opts.route ? [] : collectComponentFacts(rt, cwd),
    opts.route ? [] : collectKitModuleFacts(rt, cwd, project.kitAliases),
    // Unlike its two neighbours above, the --route branch gets `undefined` here, not `[]`: an empty
    // inventory would tell architecture/unit-entry-file that the declared unit directories truly do
    // not exist, so it would report every declaration as inert, whereas `undefined` means the mode
    // never collected the fact at all, and the rule stays silent instead of raising a false alarm.
    opts.route ? undefined : collectSourceFiles(rt, cwd)
  ]);
  const heads = collected.heads.filter((h) => matches(h.route));
  const images = collected.images.filter((i) => matches(i.route));
  const headings = collected.headings.filter((h) => matches(h.route));
  const a11y = collected.a11y.filter((a) => matches(a.route));
  const directives = new Map<string, readonly SuppressionDirective[]>();
  // Every promise in the cache has already settled — `collectRoutes` awaited them all, and a read
  // failure rejects out of it rather than being swallowed, so awaiting again cannot throw here.
  for (const [file, parsed] of parseCache) directives.set(file, (await parsed).suppressions);
  // The union is what makes `--route` behave like a full run: the two branches above leave these
  // empty, and a component the composition never reached is only in this half.
  for (const c of components) if (c.suppressions?.length) directives.set(c.file, c.suppressions);
  for (const m of kitModules) if (m.suppressions?.length) directives.set(m.file, m.suppressions);
  return { heads, images, headings, a11y, project, components, kitModules, sourceFiles, directives };
}
