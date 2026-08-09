#!/usr/bin/env node
import { runCli } from './cli.js';

/** Thin entry point: `runCli` does the full dispatch and never exits the process itself — see `CliResult.exit` for why the two mechanics below still have to differ per path. */
async function main(): Promise<void> {
  const { code, exit } = await runCli(process.argv.slice(2));
  if (exit === 'immediate') {
    process.exit(code);
  } else {
    process.exitCode = code;
  }
}

void main();
