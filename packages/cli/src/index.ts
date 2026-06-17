import {
  allRules,
  runRules,
  formatConsoleReport,
  summarize,
  hasFailureAtOrAbove,
  defineConfig
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import { sourceHeadProvider } from './providers/source/routes.js';
import { detectProject, ProjectError } from './providers/source/project.js';

export interface RunOptions {
  cwd?: string;
  log?: (line: string) => void;
  errorLog?: (line: string) => void;
  metaComponents?: string[];
  treatDynamicAs?: 'pass' | 'warn' | 'fail';
  /** Restrict analysis to routes whose path matches this glob (matched against the route path without leading slash). */
  route?: string;
}

function routeMatcher(glob: string | undefined): (route: string) => boolean {
  if (!glob) return () => true;
  const body = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
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
    metaComponents: opts.metaComponents ?? []
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
    const results = await runRules(allRules, { heads, config });
    log(formatConsoleReport(results, config));
    const summary = summarize(results, config);
    return hasFailureAtOrAbove(summary, 'critical') ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}
