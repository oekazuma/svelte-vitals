import { terminalSafe } from '@svelte-vitals/core/internal';

/** Output sink for the read-only subcommands. Narrower than `InstallIO` — no filesystem access. */
export interface CliIO {
  log(line: string): void;
  errorLog(line: string): void;
}

export const consoleIO: CliIO = {
  // log carries the console reporter's own ANSI-styled report (e.g. formatConsoleReport); that
  // reporter already sanitizes tainted analyzed-repo substrings at interpolation points
  // (reporter/console.ts), so wrapping the whole sink here would strip its deliberate SGR color
  // codes along with them.
  log: (line) => console.log(line),
  // errorLog carries analyzed-repo strings (fs error messages, paths) with no deliberate
  // styling — same threat model as reporter/sanitize.ts.
  errorLog: (line) => console.error(terminalSafe(line))
};
