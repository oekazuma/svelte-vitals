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
  type RuleSetting
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import { sourceHeadProvider } from './providers/source/routes.js';
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

/**
 * Run static-mode analysis once and return the process exit code (design §6):
 *   0 = no failing findings, 1 = critical finding present, 2 = execution error.
 */
export async function run(opts: RunOptions = {}): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  const log = opts.log ?? ((line: string) => console.log(line));
  const errorLog = opts.errorLog ?? ((line: string) => console.error(line));
  const rt = createNodeRuntime();
  const config = defineConfig({
    treatDynamicAs: opts.treatDynamicAs ?? 'pass',
    metaComponents: opts.metaComponents ?? [],
    rules: opts.rules ?? {},
    failOn: opts.failOn ?? 'critical'
  });

  try {
    await detectProject(rt, cwd);
  } catch (err) {
    if (err instanceof ProjectError) {
      errorLog(err.message);
      return 2;
    }
    throw err;
  }

  try {
    const matches = routeMatcher(opts.route);
    const heads = (await sourceHeadProvider.collect(rt, cwd, config)).filter((h) => matches(h.route));
    const project = await collectProjectFacts(rt, cwd);
    const rules = selectRules(allRules, config);
    const results = applyRuleSeverities(await runRules(rules, { heads, project, config }), config);
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
      log(formatJsonReport(results, config, { version: readPackageVersion() }));
    } else if (reporter === 'agent') {
      log(formatAgentReport(results, config));
    } else if (reporter === 'sarif') {
      log(formatSarifReport(results, config, { version: readPackageVersion() }));
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
