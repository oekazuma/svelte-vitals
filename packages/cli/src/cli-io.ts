/** Output sink for the read-only subcommands. Narrower than `InstallIO` — no filesystem access. */
export interface CliIO {
  log(line: string): void;
  errorLog(line: string): void;
}

export const consoleIO: CliIO = {
  log: (line) => console.log(line),
  errorLog: (line) => console.error(line)
};
