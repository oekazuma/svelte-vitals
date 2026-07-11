#!/usr/bin/env node
import mri from 'mri';
import * as p from '@clack/prompts';
import { run } from './index.js';
import { readPackageVersion, readCoreVersion } from './version.js';
import { resolveArgs } from './resolve-args.js';
import { runInstallCli } from './install/cli.js';
import { runCiCli } from './ci/cli.js';

const HELP = `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture)

Usage:
  svelte-vitals [path] [options]
  svelte-vitals install          Set up the MCP server, Vite integration, or agent skills/rules
  svelte-vitals ci install       Add a GitHub Actions PR gate (annotations + summary comment)

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  --diff [ref]                Report only findings in files changed vs ref (default HEAD; e.g. --diff main)
  --staged                    Report only findings in files staged for commit (pre-commit gate)
  --baseline <ref>            Report only findings not present at ref (compare against e.g. origin/main)
  --by-route                  Show per-route score breakdown in console output
  --reporter <fmt>            console | json | agent | sarif | github | html | md (auto: agent under AI-agent envs, github under GitHub Actions)
  --out-file <path>           Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)
  --json                      Alias for --reporter=json
  --fail-on <severity>        Fail (exit 1) when any finding reaches this severity: critical | warning | info
  --fail-on-warning           Alias for --fail-on=warning
  --min-health <0-100>        Fail (exit 1) when the combined Health score is below this value
  --rules <ids>               Comma-separated rule ids to enable (all others disabled)
  --ignore <ids>              Comma-separated rule ids to disable
  --category <cats>           Comma-separated categories to analyze: seo | performance | correctness | security | architecture
  --weights <pairs>           Per-category Health weight overrides, e.g. seo=2,performance=1 (unlisted categories default to 1)
  --score                     Print only the combined Health score (works with --min-health for gating)
  --no-color                  Disable ANSI color in console output
  --no-animation               Disable the Health-score reveal animation and mascot on an interactive terminal
  --verbose                    Show every finding uncapped and ungrouped (default: capped, grouped by rule)
  -h, --help                  Show this help
  -v, --version               Show version

Config file:
  svelte-vitals.config.{mjs,js,ts} in the analyzed directory; flags override it.

Exit codes:
  0  no failing findings
  1  critical finding present (or --fail-on threshold reached)
  2  execution error (not a SvelteKit project / internal error)`;

const VERSION = readPackageVersion();

/** Monorepo app picker (design doc 2026-07-08-monorepo-app-picker-design.md): single-select via @clack/prompts, same style as the `install` wizard. */
async function selectApp(apps: string[]): Promise<string | null> {
  const res = await p.select({
    message: 'Multiple SvelteKit apps found — which one should svelte-vitals analyze?',
    options: apps.map((a) => ({ value: a, label: a }))
  });
  return p.isCancel(res) ? null : (res as string);
}

/** CLI entrypoint: dispatches `install`/`ci` subcommands, otherwise parses argv, resolves it into `run()` options, executes the analysis, and exits with the resulting code. */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs[0] === 'install') {
    const code = await runInstallCli(rawArgs.slice(1));
    process.exit(code);
  }
  if (rawArgs[0] === 'ci') {
    const code = await runCiCli(rawArgs.slice(1));
    process.exit(code);
  }

  const argv = mri(process.argv.slice(2), {
    alias: { h: 'help', v: 'version' },
    boolean: ['by-route', 'json', 'fail-on-warning', 'staged', 'score', 'verbose'],
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
      'weights',
      'category'
    ]
  });

  if (argv.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (argv.version) {
    // Printing the resolved core version alongside the CLI's own lets users compare
    // it directly against the `@svelte-vitals/vite` dev overlay's "core vX.Y.Z" line —
    // the two packages are versioned independently and can drift (see docs).
    console.log(`${VERSION} (core ${readCoreVersion()})`);
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

  const code = await run({
    ...options,
    minHealth,
    selectApp
  });
  process.exit(code);
}

void main();
