import {
  allRules,
  selectRules,
  applyRuleSeverities,
  applyOverrides,
  runRules,
  computeScore,
  summarize,
  hasFailureAtOrAbove,
  formatConsoleReport,
  formatJsonReport,
  defineConfig,
  type Config,
  type Result,
  type Summary,
  type Severity,
  type Project
} from '@svelte-vitals/core';
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
  /** Non-fatal config-file issues (unknown top-level keys, invalid enum values). Empty when no config file exists. */
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
  const [{ heads, headings, images, htmlLang }, components, sourceFiles] = await Promise.all([
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
  const { results: rawResults, examined } = await runRules(selected, {
    heads,
    headings,
    images,
    project,
    components,
    config,
    kitModules,
    sourceFiles
  });
  const results = applyOverrides(applyRuleSeverities(rawResults, config), config);

  const { score } = computeScore(results, config);
  const summary = summarize(results, config);
  const failed = hasFailureAtOrAbove(summary, config.failOn);

  const coverageNote =
    `Analyzed ${heads.length} prerendered route(s). ` +
    'SSR/dynamic routes are not covered — run `npx svelte-vitals` for those.\n' +
    `Scanned ${components.length} component(s) under src/ for Correctness/Security/Architecture/Bundle findings.`;
  const consoleReport =
    formatConsoleReport(results, config, { mode: 'rendered / plugin' }) + '\n' + coverageNote + '\n';
  const jsonReport = formatJsonReport(
    results,
    config,
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
    failOn: config.failOn,
    warnings
  };
}
