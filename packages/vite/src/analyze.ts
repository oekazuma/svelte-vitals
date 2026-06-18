import {
  allRules,
  selectRules,
  applyRuleSeverities,
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
import type { SvelteVitalsOptions } from './plugin.js';
import { collectRenderedHeads } from './providers/rendered/collect.js';
import { collectRenderedProject } from './providers/rendered/project.js';
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
}

/** Collect prerendered heads + project facts, run the core pipeline, and format reports. */
export async function analyze(
  prerenderPagesDir: string,
  cwd: string,
  options: SvelteVitalsOptions
): Promise<AnalyzeResult> {
  const config = defineConfig({
    treatDynamicAs: options.treatDynamicAs ?? 'pass',
    metaComponents: options.metaComponents ?? [],
    rules: options.rules ?? {},
    failOn: options.failOn ?? 'critical'
  });

  const { heads, htmlLang } = await collectRenderedHeads(prerenderPagesDir);
  const project = await collectRenderedProject(cwd, htmlLang);
  const results = applyRuleSeverities(
    await runRules(selectRules(allRules, config), { heads, project, config }),
    config
  );

  const { score } = computeScore(results, config);
  const summary = summarize(results, config);
  const failed = hasFailureAtOrAbove(summary, config.failOn);

  const header =
    `Svelte Vitals  ·  SEO (rendered / plugin)\n` +
    `Analyzed ${heads.length} prerendered route(s). SSR/dynamic routes are not covered — run \`npx svelte-vitals\` for those.\n`;
  const consoleReport = header + '\n' + formatConsoleReport(results, config);
  const jsonReport = formatJsonReport(results, config, { version: readPackageVersion() });

  return {
    score,
    summary,
    results,
    consoleReport,
    jsonReport,
    routeCount: heads.length,
    failed,
    failOn: config.failOn
  };
}
