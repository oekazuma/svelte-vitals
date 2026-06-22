import {
  allRules,
  runRules,
  formatConsoleReport,
  formatJsonReport,
  formatAgentReport,
  formatSarifReport,
  formatGithubReport,
  summarize,
  hasFailureAtOrAbove,
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
import { detectProject, ProjectError, collectProjectFacts } from './providers/source/project.js';
import { collectA11y } from './providers/source/a11y.js';
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
  const project = await collectProjectFacts(rt, cwd);
  const rules = selectRules(allRules, config);
  const a11y = (await collectA11y(rt, cwd, config)).filter((r) => r.route === undefined || matches(r.route));
  const ruleResults = await runRules(rules, { heads, images, project, config });
  const results = applyRuleSeverities([...ruleResults, ...a11y], config);
  return { results, config, version: readPackageVersion() };
}

/**
 * Run static-mode analysis once and return the process exit code (design §6):
 *   0 = no failing findings, 1 = critical finding present, 2 = execution error.
 */
export async function run(opts: RunOptions = {}): Promise<number> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));

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
    } else {
      log(formatConsoleReport(results, config, { byRoute: opts.byRoute ?? false }));
    }
    const summary = summarize(results, config);
    return hasFailureAtOrAbove(summary, config.failOn) ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}

export { ProjectError } from './providers/source/project.js';
export { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
