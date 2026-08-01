import type { CliIO } from '../../src/cli-io.js';

/**
 * A `CliIO` that records what a subcommand wrote, keeping stdout and stderr apart so a test can
 * assert both — most of these subcommands promise an empty stdout on their exit-2 paths.
 */
export function captureIO(): CliIO & { out: string; err: string } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    log: (line) => out.push(line),
    errorLog: (line) => err.push(line),
    get out() {
      return out.join('\n');
    },
    get err() {
      return err.join('\n');
    }
  };
}
