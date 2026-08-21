import { defineConfig, type Config, type Result, type Summary, type Severity } from '@svelte-vitals/core';
import {
  allRules,
  selectRules,
  applyRuleSeverities,
  applyOverrides,
  applyInlineDirectives,
  unknownDirectiveIds,
  runRules,
  withFailedRulesOff,
  formatFailedRuleWarning,
  skippedFileWarnings,
  computeScore,
  summarize,
  hasFailureAtOrAbove,
  formatConsoleReport,
  formatJsonReport,
  type Project,
  type SuppressionDirective
} from '@svelte-vitals/core/internal';
import { loadConfigFile } from 'svelte-vitals';
import type { SvelteVitalsOptions } from './plugin.js';
import { collectRenderedHeads } from './providers/rendered/collect.js';
import { collectRenderedProject } from './providers/rendered/project.js';
import { collectComponentFacts, collectKitModuleFacts, collectSourceFiles } from './providers/source/components.js';
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
 * Collect prerendered heads + project facts + component facts, run the core pipeline, and
 * format reports. Config precedence: see `resolveConfig`. Pass `resolved` when the caller
 * already resolved config itself (build mode resolves it outside `analyze`'s try/catch so a
 * config-file validation error fails the build instead of being caught as an analysis error).
 */
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions,
  extraProjectFacts?: Partial<Project>,
  resolved?: { config: Config; warnings: string[] }
): Promise<AnalyzeResult> {
  const { config, warnings } = resolved ?? (await resolveConfig(cwd, options));

  // collectRenderedProject needs htmlLang out of the rendered-head parse pass, so it can't
  // join the Promise.all below; components/sourceFiles have no such dependency and do.
  const [{ heads, headings, images, a11y, htmlLang }, components, sourceFiles] = await Promise.all([
    collectRenderedHeads(prerenderPagesDir),
    collectComponentFacts(cwd),
    collectSourceFiles(cwd)
  ]);
  const project = {
    ...(await collectRenderedProject(cwd, htmlLang)),
    ...extraProjectFacts
  };
  const kitModules = await collectKitModuleFacts(cwd, project.kitAliases);
  const selected = selectRules(allRules, config);
  // Rendered collection marks every route fully resolved, so the opt-in open-world rule can
  // never fire here — say so instead of holding a silent no-op lever (design 2026-08-21).
  if (selected.some((r) => r.id === 'a11y/unverified-id-ref')) {
    warnings.push(
      'a11y/unverified-id-ref has no effect in rendered mode — the prerendered document is always fully resolved.'
    );
  }
  const {
    results: rawResults,
    examined,
    failedRules
  } = await runRules(selected, {
    heads,
    headings,
    images,
    a11y,
    project,
    components,
    config,
    kitModules,
    sourceFiles
  });
  // Rendered-mode route findings anchor to the prerendered HTML with `line: 0`, so directives reach
  // only what has a source line here: the component and Kit-module findings, plus
  // performance/minify-disabled in the Vite config. The pass runs all the same, so a rule gaining a
  // line-anchored finding is covered in both pipelines without a second wiring step.
  const directives = new Map<string, readonly SuppressionDirective[]>();
  for (const c of components) directives.set(c.file, c.suppressions ?? []);
  for (const m of kitModules) directives.set(m.file, m.suppressions ?? []);
  if (project.viteMinifyDisabled?.file)
    directives.set(project.viteMinifyDisabled.file, project.viteMinifyDisabled.suppressions ?? []);
  const results = applyInlineDirectives(
    applyOverrides(applyRuleSeverities(rawResults, config), config),
    directives,
    selected,
    config
  );
  // Surfaced through the same `warnings` channel as config-file issues (plugin.ts logs each with
  // `console.warn`). A file the collectors could not read or parse contributes empty facts, so its
  // findings go missing rather than showing as fixed — the build has to say so, exactly as the CLI
  // does, and through the same formatter so the two never drift apart.
  warnings.push(...skippedFileWarnings([...components, ...kitModules]));
  warnings.push(...unknownDirectiveIds(directives, allRules));
  for (const f of failedRules) warnings.push(formatFailedRuleWarning(f));
  // A failed rule examined nothing, so its weight must not stay in the Health denominator — same
  // correction the CLI's `analyzeProject` applies, used by every downstream consumer here so the
  // score, reports, and fail decision agree.
  const scoringConfig = withFailedRulesOff(
    config,
    failedRules.map((f) => f.id)
  );

  const { score } = computeScore(results, scoringConfig);
  const summary = summarize(results, scoringConfig);
  const failed = hasFailureAtOrAbove(summary, scoringConfig.failOn);

  const coverageNote =
    `Analyzed ${heads.length} prerendered route(s). ` +
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
    routeCount: heads.length,
    failed,
    failOn: scoringConfig.failOn,
    warnings
  };
}
