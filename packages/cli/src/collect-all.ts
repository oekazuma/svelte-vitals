import {
  collectKitModuleFacts,
  collectSourceFiles,
  type ComponentFacts,
  type Config,
  type KitModuleFacts,
  type Project,
  type ResolvedHead,
  type ResolvedHeadings,
  type ResolvedImages,
  type Runtime
} from '@svelte-vitals/core';
import { collectComponentFacts } from './providers/source/components.js';
import { collectProjectFacts } from './providers/source/project.js';
import type { ParseCache } from './providers/source/resolve.js';
import { collectRoutes } from './providers/source/routes.js';
import { routeMatcher } from './route-matcher.js';

/** Everything the rule engine needs about a project, gathered through the Runtime. */
export interface CollectedFacts {
  heads: ResolvedHead[];
  images: ResolvedImages[];
  headings: ResolvedHeadings[];
  project: Project;
  components: ComponentFacts[];
  kitModules: KitModuleFacts[];
  /** `undefined` (not `[]`) for a route-filtered run — see the comment at the call site. */
  sourceFiles: string[] | undefined;
}

export interface CollectAllOptions {
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
 * fixed I/O budget: a collector added here falls under that budget automatically,
 * with no test change. See docs/superpowers/specs/2026-07-29-io-budget-ci-design.md.
 */
export async function collectAll(
  rt: Runtime,
  cwd: string,
  config: Config,
  opts: CollectAllOptions = {}
): Promise<CollectedFacts> {
  const matches = routeMatcher(opts.route);
  const collected = await collectRoutes(rt, cwd, config, opts.parseCache);
  const heads = collected.heads.filter((h) => matches(h.route));
  const images = collected.images.filter((i) => matches(i.route));
  const headings = collected.headings.filter((h) => matches(h.route));
  const project = await collectProjectFacts(rt, cwd);
  // Component (Correctness) facts are file-scoped with no route attribution yet, so a
  // route-filtered run skips them rather than reporting unrelated components (#68 review);
  // kitModules is skipped for the same reason.
  const components = opts.route ? [] : await collectComponentFacts(rt, cwd);
  const kitModules = opts.route ? [] : await collectKitModuleFacts(rt, cwd);
  // Unlike its two neighbours above, the --route branch gets `undefined` here, not `[]`: an empty
  // inventory would tell architecture/unit-entry-file that the declared unit directories truly do
  // not exist, so it would report every declaration as inert, whereas `undefined` means the mode
  // never collected the fact at all, and the rule stays silent instead of raising a false alarm.
  const sourceFiles = opts.route ? undefined : await collectSourceFiles(rt, cwd);
  return { heads, images, headings, project, components, kitModules, sourceFiles };
}
