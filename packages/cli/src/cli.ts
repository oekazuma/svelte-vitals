import { realIO } from './install/cli.js';
import { consoleIO, type CliIO } from './cli-io.js';
import { runAnalyzeCliGunshi } from './gunshi/analyze.js';
import { resolveLocale } from './gunshi/locale.js';

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
 *
 * `env` resolves the `--help` locale exactly once per invocation (`docs/superpowers/specs/
 * 2026-08-11-cli-ja-help-design.md`) — never re-resolved per surface, so a single invocation can't
 * observe two different locales. `complete` is deliberately excluded from the localized dispatchers:
 * its command tree is always built from the raw English declarations regardless of `locale`.
 */
export async function runCli(
  argv: string[],
  io: CliIO = consoleIO,
  env: NodeJS.ProcessEnv = process.env
): Promise<CliResult> {
  try {
    const locale = resolveLocale(env);

    if (argv[0] === 'complete') {
      // Loaded on demand, same reasoning as `docs`/`explain` below. Passed the FULL argv, not
      // `argv.slice(1)` — see gunshi/complete.ts's own doc comment for why this one branch differs.
      const { runCompleteCliGunshi } = await import('./gunshi/complete.js');
      return { code: await runCompleteCliGunshi(argv, io), exit: 'natural' };
    }
    if (argv[0] === 'docs') {
      // Loaded on demand: the bundled topics are ~20KB of string literals that the analysis path
      // — the one the I/O budget test and `pnpm bench` defend — would otherwise parse every run.
      const { runDocsCliGunshi } = await import('./gunshi/docs.js');
      return { code: await runDocsCliGunshi(argv.slice(1), io, locale), exit: 'natural' };
    }
    if (argv[0] === 'explain') {
      const { runExplainCliGunshi } = await import('./gunshi/explain.js');
      return { code: await runExplainCliGunshi(argv.slice(1), io, locale), exit: 'natural' };
    }
    if (argv[0] === 'install') {
      const { runInstallCliGunshi } = await import('./gunshi/install.js');
      return { code: await runInstallCliGunshi(argv.slice(1), io, locale), exit: 'immediate' };
    }
    if (argv[0] === 'ci') {
      // ci's own IO is disk-backed (realIO()) for reading/writing the workflow file; only the
      // log/errorLog sinks are swapped for the caller's, so a test-injected `io` still observes
      // everything ci prints without having to fake the filesystem for paths that never touch it
      // (--help, the error surfaces below).
      const { runCiCliGunshi } = await import('./gunshi/ci.js');
      const code = await runCiCliGunshi(argv.slice(1), { ...realIO(), log: io.log, errorLog: io.errorLog }, locale);
      return { code, exit: 'immediate' };
    }

    return await runAnalyzeCliGunshi(argv, io, locale);
  } catch (err) {
    // Last-resort net: any throw that escapes the dispatchers above is an internal crash, not a
    // failing finding — exit 2 keeps that distinction visible to a CI gate reading the exit code.
    io.errorLog(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
    return { code: 2, exit: 'natural' };
  }
}
