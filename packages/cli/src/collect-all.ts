import { type Config } from '@svelte-vitals/core';
import {
  addFactsDirectives,
  collectComponentFacts,
  collectKitModuleFacts,
  collectSourceFiles,
  compileOverrides,
  layoutNeverRenders,
  pageRendersOnlyWhenBuilding,
  ROBOTS_SOURCE_PATHS,
  routeNeverSsr,
  SITEMAP_SOURCE_PATHS,
  SVELTE_CONFIG_FILES,
  VITE_CONFIG_FILES,
  type ComponentFacts,
  type DirectiveIndex,
  type HeadTag,
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
import { BROAD_KINDS, dropConstantListEachBlocks, tagKey, type ParseCache } from './providers/source/resolve.js';
import { collectRoutes, deriveRoute } from './providers/source/routes.js';
import { urlHolds } from './providers/source/url-cond.js';
import { routeMatcher } from './route-matcher.js';

/** An override's `route`/`files` field as a list — the schema allows one glob or many. */
function globList(globs: string | string[] | undefined): string[] {
  return globs === undefined ? [] : Array.isArray(globs) ? globs : [globs];
}

const PAGE_MODULE_RE = /\/\+page(\.server)?\.(ts|js)$/;
const HOOKS_RE = /(^|\/)src\/hooks\.server\.(ts|js)$/;

/**
 * The tags a `transformPageChunk` in `hooks.server` may write into the shell's `<head>`: when it replaces a
 * whole comment that sits there (`<!--seo-head-->`), what it writes is unknown, so every route may carry the meta
 * family an opaque head source implies, dynamic, beneath its own tags.
 */
function pageChunkFill(kitModules: KitModuleFacts[], project: Project): HeadTag[] {
  const tokens = kitModules.filter((m) => HOOKS_RE.test(m.file)).flatMap((m) => m.pageChunkTokens ?? []);
  const comments = project.appHtmlHeadComments ?? [];
  if (!tokens.some((t) => comments.includes(t))) return [];
  return BROAD_KINDS.map((t) => ({ ...t, presence: 'inherited', file: 'src/app.html' }) as HeadTag);
}

/** Routes the app's `hooks.server` answers before `resolve()` on every request (`answeredPaths`). */
async function hooksAnswered(
  rt: Runtime,
  cwd: string,
  kitModules: KitModuleFacts[],
  heads: { route: string }[],
  project: Project,
  sourceFiles: string[] | undefined
): Promise<string[]> {
  const conds = kitModules.filter((m) => HOOKS_RE.test(m.file)).flatMap((m) => m.answeredPaths ?? []);
  // `event.url.pathname` carries `kit.paths.base`, and a `reroute` in `src/hooks` serves a route at
  // other paths too (paraglide's `/id`), so the path the hook tests is not the route's own.
  if (conds.length === 0 || project.kitPathsBase) return [];
  const universal =
    sourceFiles?.filter((f) => /^src\/hooks\.(ts|js)$/.test(f)) ?? (await rt.glob('src/hooks.{ts,js}', cwd));
  if (universal.length > 0) return [];
  return heads.map((h) => h.route).filter((r) => conds.some((c) => urlHolds(c, r) === true));
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
  const componentAliases = project.componentAliases ?? project.kitAliases;
  const [collected, components, allKitModules, sourceFiles] = await Promise.all([
    collectRoutes(
      rt,
      cwd,
      config,
      parseCache,
      componentAliases,
      project.appHtmlIds,
      project.appHtmlBodyTags,
      project.appHtmlHeadTags,
      project.headAliases
    ),
    // Component (Correctness) facts are file-scoped with no route attribution yet, so a
    // route-filtered run skips them rather than reporting unrelated components (#68 review).
    opts.route
      ? []
      : collectComponentFacts(rt, cwd).then((facts) =>
          dropConstantListEachBlocks({ rt, cwd, cache: parseCache, aliases: componentAliases }, facts)
        ),
    // Read under `--route` too, for the redirect-only gate below; the rules still get none then.
    collectKitModuleFacts(rt, cwd, project.kitAliases),
    // Unlike its two neighbours above, the --route branch gets `undefined` here, not `[]`: an empty
    // inventory would tell architecture/unit-entry-file that the declared unit directories truly do
    // not exist, so it would report every declaration as inert, whereas `undefined` means the mode
    // never collected the fact at all, and the rule stays silent instead of raising a false alarm.
    opts.route ? undefined : collectSourceFiles(rt, cwd)
  ]);
  // Kit-module facts are file-scoped too, so a route-filtered run hands the rules none.
  const kitModules = opts.route ? [] : allKitModules;
  // What a component loaded with `import()` renders is not in a server-rendered route's HTML.
  const ssrScope = { kitModules: allKitModules, sourceFiles: collected.routeFiles, project };
  // A page whose own load, a layout load above it, or a script it renders through always redirects or
  // errors never renders itself, so it has no route-level facts.
  const redirectOnly = new Set([
    ...allKitModules.filter((m) => m.loadNeverRenders && PAGE_MODULE_RE.test(m.file)).map((m) => deriveRoute(m.file)),
    ...collected.heads
      .filter((h) => layoutNeverRenders(h.file, ssrScope) || pageRendersOnlyWhenBuilding(h.file, ssrScope))
      .map((h) => h.route),
    ...collected.neverRenders,
    ...(await hooksAnswered(rt, cwd, allKitModules, collected.heads, project, sourceFiles))
  ]);
  const routeLevel = (route: string) => matches(route) && !redirectOnly.has(route);
  const chunkFill = pageChunkFill(allKitModules, project);
  const heads = collected.heads
    .filter((h) => routeLevel(h.route))
    .map((h) =>
      h.tags.some((t) => t.clientOnly) && !routeNeverSsr(h.file, ssrScope)
        ? { ...h, tags: h.tags.filter((t) => !t.clientOnly) }
        : h
    )
    .map((h) => {
      const have = new Set(h.tags.map((t) => tagKey(t)));
      const fill = chunkFill.filter((t) => !have.has(tagKey(t)));
      return fill.length === 0 ? h : { ...h, tags: [...h.tags, ...fill] };
    });
  const images = collected.images.filter((i) => routeLevel(i.route));
  const pageOf = new Map(collected.heads.map((h) => [h.route, h.file]));
  const headings = collected.headings
    .filter((h) => routeLevel(h.route))
    .map(({ clientOnlyHeading, ...h }) =>
      clientOnlyHeading && routeNeverSsr(pageOf.get(h.route)!, ssrScope) ? { ...h, dynamicHeading: true } : h
    );
  const a11y = collected.a11y.filter((a) => routeLevel(a.route));
  // Every file the run read is entered, directives or not, so `has(file)` answers "was this file
  // scanned" — the invariant `test/directive-coverage.test.ts` checks against the real gallery.
  const directives = new Map<string, readonly SuppressionDirective[]>();
  // A cache entry can be rejected — the dev dashboard keeps its cache across analyses and evicts
  // only the file the watcher named, so a stale rejection outlives the edit that fixed it.
  for (const [file, parsed] of parseCache) {
    const suppressions = await parsed.then(
      // A barrel's entry holds its re-exports only; no finding is ever located in one.
      (entry) => ('suppressions' in entry ? entry.suppressions : undefined),
      () => undefined
    );
    if (suppressions) directives.set(file, suppressions);
  }
  // The union is what makes `--route` behave like a full run: the two branches above leave these
  // empty, and a component the composition never reached is only in this half.
  addFactsDirectives(directives, { components, kitModules, viteMinifyDisabled: project.viteMinifyDisabled });

  const routes = collected.heads.map((h) => h.route);
  const emptySelections: string[] = [];
  // Exiting 0 on a glob that selected no route reads as "clean", which is how #510 stayed hidden.
  // Gated on the project having routes at all, so an empty project is not reported as a bad glob.
  if (opts.route !== undefined && routes.length > 0 && !routes.some(matches))
    emptySelections.push(
      `--route '${opts.route}' matched none of the ${routes.length} route(s) found — routes are URL paths, e.g. --route '/blog/**'; list them with --reporter json → routes.`
    );
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
          emptySelections.push(
            `overrides entry for route '${glob}' matched no route — route globs are URL paths, e.g. '/blog/**'; see \`svelte-vitals docs show config\`.`
          );
      });
      globList(entry.files).forEach((glob, j) => {
        const pattern = compiled[i]?.files[j];
        if (pattern && !attributable.some((f) => pattern.test(f)))
          emptySelections.push(
            `overrides entry for files '${glob}' matched no file — file globs are project-relative, e.g. 'src/lib/**'; see \`svelte-vitals docs show config\`.`
          );
      });
    });
  }
  return { heads, images, headings, a11y, project, components, kitModules, sourceFiles, directives, emptySelections };
}
