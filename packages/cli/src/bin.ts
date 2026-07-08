#!/usr/bin/env node
import mri from 'mri';
import { run } from './index.js';
import { readPackageVersion } from './version.js';
import { resolveArgs } from './resolve-args.js';
import { runInstallCli } from './install/cli.js';

const HELP = `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture)

Usage:
  svelte-vitals [path] [options]
  svelte-vitals install          Set up the MCP server for Claude Code / Cursor / Codex

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  --diff [ref]                Report only findings in files changed vs ref (default HEAD; e.g. --diff main)
  --staged                    Report only findings in files staged for commit (pre-commit gate)
  --baseline <ref>            Report only findings not present at ref (compare against e.g. origin/main)
  --by-route                  Show per-route score breakdown in console output
  --reporter <fmt>            console | json | agent | sarif | github | html (auto: agent under AI-agent envs, github under GitHub Actions)
  --out-file <path>           Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)
  --json                      Alias for --reporter=json
  --fail-on <severity>        Fail (exit 1) when any finding reaches this severity: critical | warning | info
  --fail-on-warning           Alias for --fail-on=warning
  --min-health <0-100>        Fail (exit 1) when the combined Health score is below this value
  --rules <ids>               Comma-separated rule ids to enable (all others disabled)
  --ignore <ids>              Comma-separated rule ids to disable
  --weights <pairs>           Per-category Health weight overrides, e.g. seo=2,performance=1 (unlisted categories default to 1)
  --no-color                  Disable ANSI color in console output
  -h, --help                  Show this help
  -v, --version               Show version

Config file:
  svelte-vitals.config.{mjs,js,ts} in the analyzed directory; flags override it.

Exit codes:
  0  no failing findings
  1  critical finding present (or --fail-on threshold reached)
  2  execution error (not a SvelteKit project / internal error)`;

const VERSION = readPackageVersion();

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === 'install') {
    const code = await runInstallCli(rawArgs.slice(1));
    process.exit(code);
  }

  const argv = mri(process.argv.slice(2), {
    alias: { h: 'help', v: 'version' },
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'no-color'],
    string: [
      'meta-components',
      'treat-dynamic-as',
      'route',
      'fail-on',
      'reporter',
      'rules',
      'ignore',
      'min-health',
      'out-file',
      'diff',
      'baseline',
      'weights'
    ]
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

  const minHealthRaw = argv['min-health'];
  let minHealth: number | undefined;
  if (minHealthRaw !== undefined) {
    const n = Number(minHealthRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      console.error(`svelte-vitals: invalid --min-health '${minHealthRaw}'; expected a number 0-100.`);
      process.exit(2);
    }
    minHealth = n;
  }

  const code = await run({ ...options, minHealth, noColor: argv['no-color'] });
  process.exit(code);
}

void main();
