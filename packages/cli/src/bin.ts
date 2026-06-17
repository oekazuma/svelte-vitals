#!/usr/bin/env node
import mri from 'mri';
import { run } from './index.js';

const HELP = `svelte-vitals — a SvelteKit SEO checker (static mode)

Usage:
  svelte-vitals [path] [options]

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  -h, --help                  Show this help
  -v, --version               Show version`;

const VERSION = '0.0.1';

async function main(): Promise<void> {
  const argv = mri(process.argv.slice(2), {
    alias: { h: 'help', v: 'version' },
    string: ['meta-components', 'treat-dynamic-as', 'route']
  });

  if (argv.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (argv.version) {
    console.log(VERSION);
    process.exit(0);
  }

  const positional = argv._[0];
  const metaComponents =
    typeof argv['meta-components'] === 'string'
      ? argv['meta-components']
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  const treatRaw = argv['treat-dynamic-as'];
  const treatDynamicAs = treatRaw === 'warn' || treatRaw === 'fail' || treatRaw === 'pass' ? treatRaw : undefined;
  const route = typeof argv.route === 'string' ? argv.route : undefined;

  const code = await run({
    cwd: positional ?? process.cwd(),
    metaComponents,
    treatDynamicAs,
    route
  });
  process.exit(code);
}

void main();
