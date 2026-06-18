#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import mri from 'mri';
import { allRules } from '@svelte-vitals/core';
import { run } from './index.js';

const HELP = `svelte-vitals — a SvelteKit SEO checker (static mode)

Usage:
  svelte-vitals [path] [options]

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  --by-route                  Show per-route score breakdown in console output
  --reporter <mode>           console | json (default: console)
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

// Read the version from the package's own package.json at runtime so it never
// drifts from the published version (dist/bin.js -> ../package.json).
function readVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const VERSION = readVersion();

function buildRulesConfig(
  allow: string[],
  ignore: Record<string, 'off' | 'critical' | 'warning' | 'info'>
): Record<string, 'off' | 'critical' | 'warning' | 'info'> {
  const rules = { ...ignore };
  if (allow.length > 0) {
    for (const r of allRules) if (!allow.includes(r.id)) rules[r.id] = 'off';
  }
  return rules;
}

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

  const toList = (v: unknown) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const ignoreRules: Record<string, 'off' | 'critical' | 'warning' | 'info'> = {};
  for (const id of toList(argv.ignore)) ignoreRules[id] = 'off';
  const allow = toList(argv.rules);
  const reporter = argv.json || argv.reporter === 'json' ? 'json' : 'console';
  const failOnRaw = argv['fail-on'];
  const failOn = argv['fail-on-warning']
    ? 'warning'
    : failOnRaw === 'warning' || failOnRaw === 'info' || failOnRaw === 'critical'
      ? failOnRaw
      : undefined;

  const code = await run({
    cwd: positional ?? process.cwd(),
    metaComponents,
    treatDynamicAs,
    route,
    reporter,
    byRoute: Boolean(argv['by-route']),
    failOn,
    rules: buildRulesConfig(allow, ignoreRules)
  });
  process.exit(code);
}

void main();
