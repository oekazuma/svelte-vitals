import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  allRules,
  runRules,
  formatConsoleReport,
  formatJsonReport,
  formatAgentReport,
  formatSarifReport,
  formatGithubReport,
  formatHtmlReport,
  summarize,
  hasFailureAtOrAbove,
  computeHealth,
  defineConfig,
  selectRules,
  applyRuleSeverities,
  type Severity,
  type RuleSetting,
  type Result,
  type Config
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import { collectRoutes } from './providers/source/routes.js';
import { collectComponentFacts } from './providers/source/components.js';
import { detectProject, ProjectError, collectProjectFacts } from './providers/source/project.js';
import { readPackageVersion } from './version.js';
import { resolveReporter, isAutoDetectedAgent, isAutoDetectedGithub, type ReporterName } from './reporter-resolve.js';

export interface RunOptions {
  cwd?: string;
  log?: (line: string) => void;
  errorLog?: (line: string) => void;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
  reporter?: ReporterName;
  byRoute?: boolean;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
  /** Override process.env for reporter auto-detection (mainly useful in tests). */
  env?: NodeJS.ProcessEnv;
  /** Fail (exit 1) when the combined Health score is below this value (0–100). */
  minHealth?: number;
  /** Output path for --reporter html (default 'svelte-vitals-report.html'; '-' = stdout). */
  outFile?: string;
  /** Injected file writer for --reporter html (defaults to node:fs writeFileSync). Mainly for tests. */
  writeFile?: (path: string, content: string) => void;
}

export function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ') // globstar placeholder
    .replace(/\*/g, '[^/]*') // single-segment wildcard (placeholder untouched)
    .replace(/\/ $/g, '(?:/.*)?') // trailing /** -> optional subtree
    .replace(/^ \//g, '(?:.*/)?') // leading **/ -> optional prefix
    .replace(/ \//g, '(?:.*/)?') // internal **/ -> optional prefix
    .replace(/\/ /g, '(?:/.*)?') // internal /** -> optional subtree
    .replace(/ /g, '.*'); // bare ** -> .*
  const re = new RegExp(`^${body}$`);
  return (route) => re.test(route.replace(/^\//, ''));
}

export interface AnalyzeOptions {
  cwd?: string;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
  failOn?: Severity;
  rules?: Record<string, RuleSetting>;
}

export interface AnalyzeResult {
  results: Result[];
  config: Config;
  version: string;
}

/**
 * Run static-mode analysis and return the structured findings + resolved config.
 * Throws ProjectError when `cwd` is not a SvelteKit project. Shared by the CLI's
 * run() and by @svelte-vitals/mcp (issue #24).
 */
export async function analyzeProject(opts: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  const cwd = opts.cwd ?? process.cwd();
  const rt = createNodeRuntime();
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? [],
    rules: opts.rules ?? {},
    failOn: opts.failOn ?? 'critical'
  });

  await detectProject(rt, cwd); // throws ProjectError if not a SvelteKit project

  const matches = routeMatcher(opts.route);
  const collected = await collectRoutes(rt, cwd, config);
  const heads = collected.heads.filter((h) => matches(h.route));
  const images = collected.images.filter((i) => matches(i.route));
  const headings = collected.headings.filter((h) => matches(h.route));
  const [project, components] = await Promise.all([collectProjectFacts(rt, cwd), collectComponentFacts(rt, cwd)]);
  const rules = selectRules(allRules, config);
  const results = applyRuleSeverities(
    await runRules(rules, { heads, images, headings, components, project, config }),
    config
  );
  return { results, config, version: readPackageVersion() };
}

/**
 * Run static-mode analysis once and return the process exit code (design §6):
 *   0 = no failing findings, 1 = critical finding present, 2 = execution error.
 */
export async function run(opts: RunOptions = {}): Promise<number> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));

  if (opts.minHealth != null && (!Number.isFinite(opts.minHealth) || opts.minHealth < 0 || opts.minHealth > 100)) {
    errorLog(`svelte-vitals: invalid minHealth '${opts.minHealth}'; expected a number 0-100.`);
    return 2;
  }

  let analysis: AnalyzeResult;
  try {
    analysis = await analyzeProject({
      cwd: opts.cwd ?? process.cwd(),
      metaComponents: opts.metaComponents,
      treatDynamicAs: opts.treatDynamicAs,
      route: opts.route,
      failOn: opts.failOn,
      rules: opts.rules
    });
  } catch (err) {
    if (err instanceof ProjectError) {
      errorLog(err.message);
      return 2;
    }
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  try {
    const { results, config, version } = analysis;
    const env = opts.env ?? process.env;
    const reporter = resolveReporter(opts.reporter, env);
    if (reporter === 'agent' && isAutoDetectedAgent(opts.reporter, env)) {
      errorLog(
        'svelte-vitals: agent reporter auto-selected (AI-agent env detected); override with --reporter console|json.'
      );
    }
    if (reporter === 'github' && isAutoDetectedGithub(opts.reporter, env)) {
      errorLog(
        'svelte-vitals: github reporter auto-selected (GitHub Actions detected); override with --reporter console|json|sarif.'
      );
    }
    if (reporter === 'json') {
      log(formatJsonReport(results, config, { version }));
    } else if (reporter === 'agent') {
      log(formatAgentReport(results, config));
    } else if (reporter === 'sarif') {
      log(formatSarifReport(results, config, { version }));
    } else if (reporter === 'github') {
      // The github reporter returns '' when there are no findings; skip logging so
      // a clean run emits no stray blank line into the Actions log.
      const output = formatGithubReport(results, config);
      if (output) log(output);
    } else if (reporter === 'html') {
      const html = formatHtmlReport(results, config, { version });
      if (opts.outFile === '-') {
        log(html);
      } else {
        // `||` (not `??`) so an empty --out-file (mri yields '' for a value-less
        // flag) falls back to the default instead of writing to an empty path.
        const path = opts.outFile || 'svelte-vitals-report.html';
        const write =
          opts.writeFile ??
          ((p: string, c: string) => {
            mkdirSync(dirname(p), { recursive: true });
            writeFileSync(p, c);
          });
        write(path, html);
        errorLog(`svelte-vitals: wrote report to ${path}`);
      }
    } else {
      log(formatConsoleReport(results, config, { byRoute: opts.byRoute ?? false }));
    }
    const summary = summarize(results, config);
    const failBySeverity = hasFailureAtOrAbove(summary, config.failOn);
    const failByHealth = opts.minHealth != null && computeHealth(results, config).health < opts.minHealth;
    return failBySeverity || failByHealth ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

export { ProjectError } from './providers/source/project.js';
export { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
