#!/usr/bin/env node
import mri from 'mri';
import { run } from './index.js';
import { readPackageVersion } from './version.js';
import { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
import { isReporterName, type ReporterName } from './reporter-resolve.js';

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
  if (typeof treatRaw === 'string' && treatDynamicAs === undefined) {
    console.error(
      `svelte-vitals: unknown --treat-dynamic-as '${treatRaw}'; expected pass|warn|fail. Defaulting to 'pass'.`
    );
  }
  const route = typeof argv.route === 'string' ? argv.route : undefined;

  const toList = (v: unknown) =>
    typeof v === 'string'
      ? v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const allow = toList(argv.rules);
  const ignore = toList(argv.ignore);
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    console.error(`svelte-vitals: unknown rule id(s) in --rules/--ignore: ${unknown.join(', ')}`);
    console.error(`Known rule ids: ${knownRuleIds().join(', ')}`);
    process.exit(2);
  }
  let reporter: ReporterName | undefined;
  if (argv.json) {
    reporter = 'json';
  } else if (typeof argv.reporter === 'string') {
    if (!isReporterName(argv.reporter)) {
      console.error(
        `svelte-vitals: unknown reporter '${argv.reporter}'. Valid values: console, json, agent, sarif, github.`
      );
      process.exit(2);
    }
    reporter = argv.reporter;
  }
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
    rules: buildRulesConfig(allow, ignore)
  });
  process.exit(code);
}

void main();
