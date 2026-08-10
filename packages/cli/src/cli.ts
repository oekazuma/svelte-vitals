import { runInstallCli, realIO } from './install/cli.js';
import { runCiCli } from './ci/cli.js';
import { consoleIO, type CliIO } from './cli-io.js';
import { runAnalyzeCliGunshi } from './gunshi/analyze.js';

export interface CliResult {
  code: number;
  /**
   * How `bin.ts`'s thin entry should terminate the process:
   * - `'natural'` — set `process.exitCode` and return; the path is fully resolved and holds no
   *   handles by the time it returns (`docs`/`explain`/`--help`/`--version`), so an explicit
   *   `process.exit` would only risk truncating an unflushed pipe write for no benefit.
   * - `'immediate'` — call `process.exit(code)` right away. `install`/`ci` hold prompts/timers
   *   that could hang a natural exit; an argv-resolution error exits before any output large
   *   enough to need a flush; the analyzer path below has already awaited its own stdout flush
   *   by the time it returns this, so `process.exit` here is safe.
   */
  exit: 'natural' | 'immediate';
}

/**
 * CLI dispatch: routes `docs`/`explain`/`install`/`ci` subcommands, otherwise hands off to the
 * root analyzer (`gunshi/analyze.ts`), which resolves argv into `run()` options, executes the
 * analysis, and computes the exit code. Never calls `process.exit` itself — see `CliResult.exit`
 * for why the caller still needs to pick between `process.exit` and `process.exitCode` per path.
 */
export async function runCli(argv: string[], io: CliIO = consoleIO): Promise<CliResult> {
  if (argv[0] === 'docs') {
    // Loaded on demand: the bundled topics are ~20KB of string literals that the analysis path
    // — the one the I/O budget test and `pnpm bench` defend — would otherwise parse every run.
    const { runDocsCliGunshi } = await import('./gunshi/docs.js');
    return { code: await runDocsCliGunshi(argv.slice(1), io), exit: 'natural' };
  }
  if (argv[0] === 'explain') {
    const { runExplainCliGunshi } = await import('./gunshi/explain.js');
    return { code: await runExplainCliGunshi(argv.slice(1), io), exit: 'natural' };
  }
  if (argv[0] === 'install') {
    return { code: await runInstallCli(argv.slice(1), io), exit: 'immediate' };
  }
  if (argv[0] === 'ci') {
    // ci's own IO is disk-backed (realIO()) for reading/writing the workflow file; only the
    // log/errorLog sinks are swapped for the caller's, so a test-injected `io` still observes
    // everything ci prints without having to fake the filesystem for paths that never touch it
    // (--help, the error surfaces below).
    const code = await runCiCli(argv.slice(1), { ...realIO(), log: io.log, errorLog: io.errorLog });
    return { code, exit: 'immediate' };
  }

  return runAnalyzeCliGunshi(argv, io);
}
