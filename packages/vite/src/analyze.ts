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
  type Result,
  type Summary,
  type Severity
} from '@svelte-vitals/core';
import { loadConfigFile } from 'svelte-vitals';
import type { SvelteVitalsOptions } from './plugin.js';
import { collectRenderedHeads } from './providers/rendered/collect.js';
import { collectRenderedProject } from './providers/rendered/project.js';
import { collectComponentFacts, collectKitModuleFacts } from './providers/source/components.js';
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
 * Collect prerendered heads + project facts + component facts, run the core pipeline, and
 * format reports. Reads `svelte-vitals.config.{mjs,js,ts}` from `cwd`, the same way the CLI's
 * `analyzeProject` does — per-field precedence: an explicit `options` value here wins,
 * otherwise the config file's value, otherwise the built-in default.
 */
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions
): Promise<AnalyzeResult> {
  const loaded = await loadConfigFile(cwd);
  const fileConfig = loaded?.config;
  const warnings = loaded?.warnings ?? [];

  const weights = options.weights ?? fileConfig?.weights;
  const overrides = options.overrides ?? fileConfig?.overrides;
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? fileConfig?.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? fileConfig?.metaComponents ?? [],
    rules: options.rules ?? fileConfig?.rules ?? {},
    failOn: options.failOn ?? fileConfig?.failOn ?? 'critical',
    ...(weights !== undefined ? { weights } : {}),
    ...(overrides !== undefined ? { overrides } : {})
  });

  const { heads, headings, images, htmlLang } = await collectRenderedHeads(prerenderPagesDir);
  const project = await collectRenderedProject(cwd, htmlLang);
  const components = await collectComponentFacts(cwd);
  const kitModules = await collectKitModuleFacts(cwd);
  const results = applyOverrides(
    applyRuleSeverities(
      await runRules(selectRules(allRules, config), { heads, headings, images, project, components, config, kitModules }),
      config
    ),
    config
  );

  const { score } = computeScore(results, config);
  const summary = summarize(results, config);
  const failed = hasFailureAtOrAbove(summary, config.failOn);

  const coverageNote =
    `Analyzed ${heads.length} prerendered route(s). ` +
    'SSR/dynamic routes are not covered — run `npx svelte-vitals` for those.\n' +
    `Scanned ${components.length} component(s) under src/ for Correctness/Security/Architecture/Bundle findings.`;
  const consoleReport =
    formatConsoleReport(results, config, { mode: 'rendered / plugin' }) + '\n' + coverageNote + '\n';
  const jsonReport = formatJsonReport(results, config, { version: readPackageVersion() });

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
