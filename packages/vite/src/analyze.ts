import { defineConfig, type Config, type Result, type Summary, type Severity } from '@svelte-vitals/core';
import {
  allRules,
  selectRules,
  unknownDirectiveIds,
  addFactsDirectives,
  runAnalysis,
  formatFailedRuleWarning,
  skippedFileWarnings,
  computeScore,
  summarize,
  hasFailureAtOrAbove,
  formatConsoleReport,
  formatJsonReport,
  type KitModuleFacts,
  type Project,
  type SuppressionDirective
} from '@svelte-vitals/core/internal';
import { loadConfigFile, loadSuppressions, type SuppressionEntry } from 'svelte-vitals';
import type { SvelteVitalsOptions } from './plugin.js';
import { collectRenderedHeads } from './providers/rendered/collect.js';
import { collectRenderedProject } from './providers/rendered/project.js';
import { collectComponentFacts, collectKitModuleFacts, collectSourceFiles } from './providers/source/components.js';
import { applySourceSuppressions } from './suppressions.js';
import { readPackageVersion } from './version.js';

export interface AnalyzeResult {
  score: number;
  summary: Summary;
  results: Result[];
  consoleReport: string;
  jsonReport: string;
  routeCount: number;
  failed: boolean;
  failOn: Severity;
  /** Non-fatal issues: config-file problems (unknown top-level keys, invalid enum values) and rules that crashed and were skipped. */
  warnings: string[];
}

/**
 * Merge plugin options over an optional loaded config file, per-field precedence (an
 * explicit `options` value wins, otherwise the file, otherwise the built-in default).
 * Extracted so the dev-server fallback (plugin.ts) can build an options-only config
 * without re-reading the config file.
 */
export function mergeConfig(options: SvelteVitalsOptions, fileConfig: Partial<Config> | undefined): Config {
  const weights = options.weights ?? fileConfig?.weights;
  const overrides = options.overrides ?? fileConfig?.overrides;
  return defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? fileConfig?.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? fileConfig?.metaComponents ?? [],
    rules: options.rules ?? fileConfig?.rules ?? {},
    failOn: options.failOn ?? fileConfig?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {}),
    ...(overrides !== undefined ? { overrides } : {})
  });
}

/**
 * Resolve the effective config the same way the CLI's `analyzeProject` does — per-field
 * precedence: an explicit `options` value wins, otherwise `svelte-vitals.config.*` in
 * `cwd`, otherwise the built-in default. Shared by build-mode `analyze()` and the dev
 * dashboard (plugin.ts). `warnings` are the config file's non-fatal issues. Throws if
 * the config file itself is invalid (unknown rule id, malformed `overrides`, …) —
 * callers decide whether that's fatal (build) or a fall-back-to-defaults warning (dev).
 */
export async function resolveConfig(
  cwd: string,
  options: SvelteVitalsOptions
): Promise<{ config: Config; warnings: string[] }> {
  const loaded = await loadConfigFile(cwd);
  const config = mergeConfig(options, loaded?.config);
  return { config, warnings: loaded?.warnings ?? [] };
}

/**
 * `ssr` is a page option: only `+page`/`+layout` modules (universal or server) can set it. Same
 * file set as `PAGE_OPTION_FILE_RE` in core's `rules/seo/ssr-disabled.ts`, which reports the fact.
 */
const PAGE_OPTION_FILE_RE = /^src\/routes\/(.*?)\/?\+(page|layout)(?:\.server)?\.[jt]s$/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One route directory segment as a pattern over the rendered (concrete) route path, leading `/` included. */
function segmentPattern(segment: string): string {
  if (/^\[\.\.\.[^\]]+\]$/.test(segment)) return '(?:/.*)?';
  if (/^\[\[[^\]]+\]\]$/.test(segment)) return '(?:/[^/]+)?';
  return (
    '/' +
    segment
      .split(/\[[^\]]+\]/)
      .map(escapeRegExp)
      .join('[^/]+')
  );
}

/**
 * Routes whose prerendered HTML is the app shell rather than the page: SvelteKit still writes a
 * file for an `ssr = false` route, but its `<head>` and body only exist once the client renders,
 * so every rendered head/heading/landmark check would report the page as empty. A `+layout`
 * covers its whole subtree, a `+page` only its own route; `(group)` directories are not URL
 * segments. Two ceilings: a child route re-enabling `ssr = true` under a disabled layout is not
 * tracked, and Kit's route precedence is not modelled, so a `[param]` route also claims a literal
 * sibling (`/docs/[slug]` matches a prerendered `/docs/intro`) — the warning lists the skipped
 * routes so a wrong skip is visible.
 */
export function ssrDisabledRouteMatcher(kitModules: readonly KitModuleFacts[]): (route: string) => boolean {
  const patterns: RegExp[] = [];
  for (const m of kitModules) {
    const match = m.ssrDisabled ? PAGE_OPTION_FILE_RE.exec(m.file) : null;
    if (!match) continue;
    const segments = match[1]!.split('/').filter((s) => s !== '' && !/^\(.+\)$/.test(s));
    const path = segments.map(segmentPattern).join('');
    patterns.push(new RegExp(match[2] === 'layout' ? `^${path}(?:/.*)?$` : `^${path}$`));
  }
  // The root route is '' here so every all-optional prefix (root, `[[lang]]`, `[...rest]`) accepts it.
  return (route) => {
    const r = route === '/' ? '' : route;
    return patterns.some((p) => p.test(r));
  };
}

/**
 * Collect prerendered heads + project facts + component facts, run the core pipeline, and
 * format reports. Config precedence: see `resolveConfig`. Pass `resolved` when the caller
 * already resolved config and loaded `svelte-vitals-suppressions.json` itself (build mode does
 * both outside `analyze`'s try/catch so a validation error fails the build instead of being
 * caught as an analysis error); `suppressions: undefined` means the file does not exist.
 */
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions,
  extraProjectFacts?: Partial<Project>,
  resolved?: { config: Config; warnings: string[]; suppressions: SuppressionEntry[] | undefined }
): Promise<AnalyzeResult> {
  const { config, warnings } = resolved ?? (await resolveConfig(cwd, options));
  const suppressions = resolved ? resolved.suppressions : loadSuppressions(cwd);

  // collectRenderedProject needs htmlLang out of the rendered-head parse pass, so it can't
  // join the Promise.all below; components/sourceFiles have no such dependency and do.
  const [rendered, components, sourceFiles] = await Promise.all([
    collectRenderedHeads(prerenderPagesDir),
    collectComponentFacts(cwd),
    collectSourceFiles(cwd)
  ]);
  const project = {
    ...(await collectRenderedProject(cwd, rendered.htmlLang)),
    ...extraProjectFacts
  };
  const kitModules = await collectKitModuleFacts(cwd, project.kitAliases);
  // The shell's `<html lang>` is still app.html's, so htmlLang above keeps reading every file.
  const isShell = ssrDisabledRouteMatcher(kitModules);
  const keep = <T extends { route: string }>(items: T[]): T[] => items.filter((i) => !isShell(i.route));
  const heads = keep(rendered.heads);
  const headings = keep(rendered.headings);
  const images = keep(rendered.images);
  const a11y = keep(rendered.a11y);
  const shells = rendered.heads
    .filter((h) => isShell(h.route))
    .map((h) => h.route)
    .sort();
  const selected = selectRules(allRules, config);
  if (shells.length > 0) {
    const shown = shells.slice(0, 10);
    const list =
      shells.length > shown.length
        ? `${shown.join(', ')}, … and ${shells.length - shown.length} more`
        : shown.join(', ');
    warnings.push(
      `skipped ${shells.length} prerendered route(s) with ssr = false — their HTML is the app shell, not the page; ` +
        `run \`npx svelte-vitals\` to check them from source: ${list}`
    );
  }
  // Rendered collection marks every route fully resolved, so the opt-in open-world rule can
  // never fire here — say so instead of holding a silent no-op lever (design 2026-08-21).
  if (selected.some((r) => r.id === 'a11y/unverified-id-ref')) {
    warnings.push(
      'a11y/unverified-id-ref has no effect in rendered mode — the prerendered document is always fully resolved.'
    );
  }
  // Rendered-mode route findings anchor to the prerendered HTML with `line: 0`, so directives reach
  // only what has a source line here: the component and Kit-module findings, plus
  // performance/minify-disabled in the Vite config. The pass runs all the same, so a rule gaining a
  // line-anchored finding is covered in both pipelines without a second wiring step.
  const directives = new Map<string, readonly SuppressionDirective[]>();
  addFactsDirectives(directives, { components, kitModules, viteMinifyDisabled: project.viteMinifyDisabled });
  const analysis = await runAnalysis(
    selected,
    { heads, headings, images, a11y, project, components, config, kitModules, sourceFiles },
    directives
  );
  const { examined, failedRules, scoringConfig } = analysis;
  let results = analysis.results;
  if (suppressions !== undefined) {
    const applied = applySourceSuppressions(results, suppressions, config);
    results = applied.results;
    warnings.push(...applied.notices);
  }
  // Surfaced through the same `warnings` channel as config-file issues (plugin.ts logs each with
  // `console.warn`). A file the collectors could not read or parse contributes empty facts, so its
  // findings go missing rather than showing as fixed — the build has to say so, exactly as the CLI
  // does, and through the same formatter so the two never drift apart.
  warnings.push(...skippedFileWarnings([...components, ...kitModules]));
  warnings.push(...unknownDirectiveIds(directives, allRules));
  for (const f of failedRules) warnings.push(formatFailedRuleWarning(f));

  const { score } = computeScore(results, scoringConfig);
  const summary = summarize(results, scoringConfig);
  const failed = hasFailureAtOrAbove(summary, scoringConfig.failOn);

  const coverageNote =
    `Analyzed ${heads.length} prerendered route(s)${shells.length > 0 ? ` (skipped ${shells.length} with ssr = false)` : ''}. ` +
    'SSR/dynamic routes are not covered — run `npx svelte-vitals` for those.\n' +
    `Scanned ${components.length} component(s) under src/ for Correctness/Security/Architecture/Accessibility/Bundle findings.`;
  const consoleReport =
    formatConsoleReport(results, scoringConfig, { mode: 'rendered / plugin' }) + '\n' + coverageNote + '\n';
  const jsonReport = formatJsonReport(
    results,
    scoringConfig,
    { version: readPackageVersion() },
    selected.map((r) => r.id),
    examined
  );

  return {
    score,
    summary,
    results,
    consoleReport,
    jsonReport,
    // Prerendered files found, shells included: plugin.ts reads 0 as "no build output yet", and
    // an all-shell SPA still needs its source-rule findings gated.
    routeCount: rendered.heads.length,
    failed,
    failOn: scoringConfig.failOn,
    warnings
  };
}
