import {
  allRules,
  runRules,
  formatConsoleReport,
  summarize,
  hasFailureAtOrAbove,
  defaultConfig
} from '@svelte-vitals/core';
import { createNodeRuntime } from './runtime/node.js';
import { sourceHeadProvider } from './providers/source/routes.js';
import { detectProject, ProjectError } from './providers/source/project.js';

export interface RunOptions {
  /** Project root to analyze. Defaults to the current working directory. */
  cwd?: string;
  /** Where report/diagnostic output goes. Defaults to console. */
  log?: (line: string) => void;
  errorLog?: (line: string) => void;
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
  const config = defaultConfig;

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
    const heads = await sourceHeadProvider.collect(rt, cwd);
    const results = await runRules(allRules, { heads, config });
    log(formatConsoleReport(results, config));
    const summary = summarize(results, config);
    return hasFailureAtOrAbove(summary, 'critical') ? 1 : 0;
  } catch (err) {
    errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }
}
