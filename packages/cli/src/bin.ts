#!/usr/bin/env node
// The shebang lets `npx svelte-vitals` execute on unix. deno/bun ignore it and
// run the file with their own runtime, so this does not lock the CLI to Node
// (design §14). A real cross-runtime entry/detector lands in a later slice.
import { run } from './index.js';

const HELP = `svelte-vitals — a SvelteKit SEO checker (static mode)

Usage:
  svelte-vitals [path]

Arguments:
  path            Project directory to analyze (default: current directory)

Options:
  -h, --help      Show this help
  -v, --version   Show version

Exit codes:
  0  no failing findings
  1  critical finding present
  2  execution error (not a SvelteKit project / internal error)`;

const VERSION = '0.0.0';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('-h') || args.includes('--help')) {
    console.log(HELP);
    process.exit(0);
  }
  if (args.includes('-v') || args.includes('--version')) {
    console.log(VERSION);
    process.exit(0);
  }

  const positional = args.find((a) => !a.startsWith('-'));
  const code = await run({ cwd: positional ?? process.cwd() });
  process.exit(code);
}

void main();
