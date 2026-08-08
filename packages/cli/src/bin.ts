#!/usr/bin/env node
import { run } from './index.js';
import { readPackageVersion, readCoreVersion } from './version.js';
import { parseRunArgs, resolveArgs } from './resolve-args.js';
import { runInstallCli, selectAppPrompt } from './install/cli.js';
import { runCiCli } from './ci/cli.js';
import { runExplainCli } from './explain.js';

const HELP = `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture)

Usage:
  svelte-vitals [path] [options]
  svelte-vitals docs list        List the bundled guides (docs show <name> prints one)
  svelte-vitals explain --list   List every rule (explain <rule-id> explains one)
  svelte-vitals install          Set up the Vite integration, agent skills/rules, config file, or CI
  svelte-vitals ci install       Add a GitHub Actions PR gate (annotations + summary comment)
  svelte-vitals ci upgrade       Refresh the pinned @svelte-vitals/action in an existing workflow

Options:
  --meta-components <names>   Comma-separated component names that emit head metadata
  --treat-dynamic-as <mode>   pass | warn | fail (default: pass)
  --route <glob>              Only analyze routes matching this glob
  --diff [ref]                Report only findings in files changed vs ref (default HEAD; e.g. --diff main)
  --staged                    Report only findings in files staged for commit (pre-commit gate)
  --baseline <ref>            Report only findings not present at ref (compare against e.g. origin/main)
  --update-suppressions       Write svelte-vitals-suppressions.json accepting all current findings (introduce gates on legacy projects)
  --no-suppressions           Ignore svelte-vitals-suppressions.json for this run
  --by-route                  Show per-route score breakdown in console output
  --reporter <fmt>            console | json | agent | sarif | github | html | md (auto: agent under AI-agent envs, github under GitHub Actions)
  --out-file <path>           Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)
  --fail-on <severity>        Fail (exit 1) when any finding reaches this severity: critical | warning | info
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
  2  execution error (not a SvelteKit project / internal error)

If you are an AI agent:
  - \`svelte-vitals docs list\` then \`docs show <name>\` — the guides ship inside this CLI, so
    they match this exact version and need no network. Read those before searching the web.
  - \`--reporter agent\` gives every failing finding a location, a concrete fix and an acceptance
    check; it is auto-selected when an agent environment is detected. \`--reporter json\` is the
    structured form.
  - \`--diff\` scopes the report to what you just changed; \`--staged\` is the pre-commit gate.
  - \`svelte-vitals explain <rule-id>\` says why a rule exists and which options it takes, before
    you decide to turn it off.
  - Do NOT reach for \`--update-suppressions\` to make a run pass: it accepts every current
    finding into a committed file and un-gates CI for all of them. Fix the findings, or scope
    the run with \`--diff\`. Only a human should decide to accept a backlog.
  - Exit 2 is never a pass — it means the analysis did not run. Read stderr.
  - Analysis never prompts when stdout is not a TTY: where it would have asked, it exits 2
    naming the flag to pass. \`install\` is the exception — non-interactively it skips its
    confirmation and writes, so pass \`--dry-run\` first if you need to see the plan.`;

const VERSION = readPackageVersion();

/** Monorepo app picker (design doc 2026-07-08-monorepo-app-picker-design.md): single-select via @clack/prompts, same style as the `install` wizard. */
function selectApp(apps: string[]): Promise<string | null> {
  return selectAppPrompt(apps, 'Multiple SvelteKit apps found — which one should svelte-vitals analyze?');
}

/** CLI entrypoint: dispatches `docs`/`explain`/`install`/`ci` subcommands, otherwise parses argv, resolves it into `run()` options, executes the analysis, and exits with the resulting code. */
async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  // `docs` and `explain` set `process.exitCode` and return rather than calling `process.exit`:
  // writes to a pipe are asynchronous, and exiting can discard whatever has not drained. Both
  // are pure-sync and hold no handles, so returning always terminates. (`install`/`ci` and the
  // analysis path below still exit directly — they hold prompts and timers, where returning
  // could hang instead; their large-output paths deserve the same treatment separately.)
  if (rawArgs[0] === 'docs') {
    // Loaded on demand: the bundled topics are ~20KB of string literals that the analysis path
    // — the one the I/O budget test and `pnpm bench` defend — would otherwise parse every run.
    const { runDocsCli } = await import('./docs/cli.js');
    process.exitCode = runDocsCli(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === 'explain') {
    process.exitCode = runExplainCli(rawArgs.slice(1));
    return;
  }
  if (rawArgs[0] === 'install') {
    const code = await runInstallCli(rawArgs.slice(1));
    process.exit(code);
  }
  if (rawArgs[0] === 'ci') {
    const code = await runCiCli(rawArgs.slice(1));
    process.exit(code);
  }

  const argv = parseRunArgs(rawArgs);

  if (argv.help) {
    console.log(HELP);
    return;
  }
  if (argv.version) {
    // Printing the resolved core version alongside the CLI's own lets users compare
    // it directly against the `@svelte-vitals/vite` live dashboard's "core vX.Y.Z" line —
    // the two packages are versioned independently and can drift (see docs).
    console.log(`${VERSION} (core ${readCoreVersion()})`);
    // stdout stays exactly the version string so it can be parsed; the pointer goes to stderr.
    // An agent that runs only `--version` and never `--help` still learns the guides exist.
    console.error('svelte-vitals: run `svelte-vitals docs list` for the bundled guides.');
    return;
  }

  const { options, warnings, errors, minHealth } = resolveArgs(argv);
  for (const w of warnings) console.error(w);
  for (const e of errors) console.error(e);
  if (!options) process.exit(2);

  const code = await run({
    ...options,
    minHealth,
    selectApp
  });
  // A write to a pipe is asynchronous, so `process.exit` can discard what has not drained — the report is
  // the largest thing this CLI writes and the first pipe buffer is 65,536 bytes. The empty write's callback
  // fires once the stream has flushed. `process.exit` rather than `process.exitCode` because this path can
  // hold an interactive prompt, where returning could hang instead.
  await new Promise((resolve) => process.stdout.write('', resolve));
  process.exit(code);
}

void main();
