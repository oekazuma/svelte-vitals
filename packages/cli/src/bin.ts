#!/usr/bin/env node
import mri from 'mri';
import { run } from './index.js';
import { readPackageVersion } from './version.js';
import { resolveArgs } from './resolve-args.js';

const HELP = `svelte-vitals — a SvelteKit SEO checker (static mode)

Usage:
  svelte-vitals [path] [options]

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  --by-route                  Show per-route score breakdown in console output
  --reporter <fmt>            console | json | agent | sarif | github (auto: agent under AI-agent envs, github under GitHub Actions)
  --json                      Alias for --reporter=json
  --fail-on <severity>        Fail (exit 1) when any finding reaches this severity: critical | warning | info
  --fail-on-warning           Alias for --fail-on=warning
  --rules <ids>               Comma-separated rule ids to enable (all others disabled)
  --ignore <ids>              Comma-separated rule ids to disable
  -h, --help                  Show this help
  -v, --version               Show version

Exit codes:
  0  no failing findings
  1  critical finding present (or --fail-on threshold reached)
  2  execution error (not a SvelteKit project / internal error)`;

const VERSION = readPackageVersion();

async function main(): Promise<void> {
  const argv = mri(process.argv.slice(2), {
    alias: { h: 'help', v: 'version' },
    boolean: ['by-route', 'json', 'fail-on-warning'],
    string: ['meta-components', 'treat-dynamic-as', 'route', 'fail-on', 'reporter', 'rules', 'ignore']
  });

  if (argv.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (argv.version) {
    console.log(VERSION);
    process.exit(0);
  }

  const { options, warnings, errors } = resolveArgs(argv);
  for (const w of warnings) console.error(w);
  for (const e of errors) console.error(e);
  if (!options) process.exit(2);

  const code = await run(options);
  process.exit(code);
}

void main();
