/**
 * The output sink for the read-only subcommands (`docs`, `explain`). Narrower than the install
 * wizard's `InstallIO` — neither touches the filesystem — and shared so that a change to how
 * subcommands emit lines (a `warn` channel, stripping color off a non-TTY) is one edit rather
 * than one per subcommand. The two are structurally identical, so TypeScript would not have
 * flagged them drifting apart.
 */
export interface CliIO {
  log(line: string): void;
  errorLog(line: string): void;
}

/** The real console-backed sink. Tests pass a capturing one instead. */
export const consoleIO: CliIO = {
  log: (line) => console.log(line),
  errorLog: (line) => console.error(line)
};
