import { type Config } from '@svelte-vitals/core';
import {
  collectComponentFacts,
  collectKitModuleFacts,
  collectSourceFiles,
  compileOverrides,
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  SVELTE_CONFIG_FILES,
  VITE_CONFIG_FILES,
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

/** An override's `route`/`files` field as a list — the schema allows one glob or many. */
function globList(globs: string | string[] | undefined): string[] {
  return globs === undefined ? [] : Array.isArray(globs) ? globs : [globs];
}

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
  /** Selections this run made that matched nothing, where matching nothing is never legitimate. */
  emptySelections: string[];
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
  const parseCache: ParseCache = opts.parseCache ?? new Map();
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
  // Every file the run read is entered, directives or not, so `has(file)` answers "was this file
  // scanned" — the invariant `test/directive-coverage.test.ts` checks against the real gallery.
  const directives = new Map<string, readonly SuppressionDirective[]>();
  // A cache entry can be rejected — the dev dashboard keeps its cache across analyses and evicts
  // only the file the watcher named, so a stale rejection outlives the edit that fixed it.
  for (const [file, parsed] of parseCache) {
    const suppressions = await parsed.then(
      (parsedFile) => parsedFile.suppressions,
      () => undefined
    );
    if (suppressions) directives.set(file, suppressions);
  }
  // The union is what makes `--route` behave like a full run: the two branches above leave these
  // empty, and a component the composition never reached is only in this half.
  for (const c of components) directives.set(c.file, c.suppressions ?? []);
  for (const m of kitModules) directives.set(m.file, m.suppressions ?? []);
  const viteConfig = project.viteMinifyDisabled;
  if (viteConfig?.file) directives.set(viteConfig.file, viteConfig.suppressions ?? []);

  const routes = collected.heads.map((h) => h.route);
  const emptySelections: string[] = [];
  // Exiting 0 on a glob that selected no route reads as "clean", which is how #510 stayed hidden.
  // Gated on the project having routes at all, so an empty project is not reported as a bad glob.
  if (opts.route !== undefined && routes.length > 0 && !routes.some(matches))
    emptySelections.push(`--route '${opts.route}' matched none of the ${routes.length} route(s) found.`);
  // Full runs only: under --route most overrides legitimately fall outside the selection.
  if (opts.route === undefined && routes.length > 0) {
    // Every path a finding's `location` can be — the files the run scanned, plus the project-scoped
    // rules' fixed targets. Judging `files` globs against `sourceFiles` alone would call an override
    // on `vite.config.ts` unmatched, which is the false alarm this whole warning exists to avoid.
    const attributable = [
      ...directives.keys(),
      ...ROBOTS_SOURCE_PATHS,
      ...SITEMAP_SOURCE_PATHS,
      ...VITE_CONFIG_FILES,
      ...SVELTE_CONFIG_FILES
    ];
    const entries = config.overrides ?? [];
    // Compiled by the same function `applyOverrides` uses, index-for-index with the glob lists, so
    // "matched nothing" here means exactly what it will mean when the results are filtered.
    const compiled = compileOverrides(config);
    entries.forEach((entry, i) => {
      globList(entry.route).forEach((glob) => {
        if (!routes.some(routeMatcher(glob)))
          emptySelections.push(`overrides entry for route '${glob}' matched no route.`);
      });
      globList(entry.files).forEach((glob, j) => {
        const pattern = compiled[i]?.files[j];
        if (pattern && !attributable.some((f) => pattern.test(f)))
          emptySelections.push(`overrides entry for files '${glob}' matched no file.`);
      });
    });
  }
  return { heads, images, headings, a11y, project, components, kitModules, sourceFiles, directives, emptySelections };
}
