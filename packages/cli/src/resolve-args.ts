import type mri from 'mri';
import type { RunOptions } from './index.js';
import { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
import { isReporterName, type ReporterName } from './reporter-resolve.js';

/** Result of normalizing parsed argv: the `run` options, plus any diagnostics to print. */
export interface ResolvedArgs {
  /** Options to pass to `run`, or `null` when a fatal (exit-2) error was found. */
  options: RunOptions | null;
  /** Non-fatal messages (printed to stderr; analysis still proceeds). */
  warnings: string[];
  /** Fatal messages (printed to stderr; the CLI exits 2 without running). */
  errors: string[];
}

const toList = (v: unknown): string[] =>
  typeof v === 'string'
    ? v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

/**
 * Normalize parsed CLI argv into `run` options without any I/O or process exit,
 * so the validation/warning behavior is unit-testable. `main` (in bin.ts) is the
 * thin wrapper that prints the diagnostics and maps a fatal result to exit code 2.
 */
export function resolveArgs(argv: mri.Argv): ResolvedArgs {
  const warnings: string[] = [];
  const errors: string[] = [];

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
    warnings.push(
      `svelte-vitals: unknown --treat-dynamic-as '${treatRaw}'; expected pass|warn|fail. Defaulting to 'pass'.`
    );
  }

  const route = typeof argv.route === 'string' ? argv.route : undefined;

  const allow = toList(argv.rules);
  const ignore = toList(argv.ignore);
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    errors.push(`svelte-vitals: unknown rule id(s) in --rules/--ignore: ${unknown.join(', ')}`);
    errors.push(`Known rule ids: ${knownRuleIds().join(', ')}`);
  }

  let reporter: ReporterName | undefined;
  if (argv.json) {
    reporter = 'json';
  } else if (typeof argv.reporter === 'string') {
    if (!isReporterName(argv.reporter)) {
      errors.push(
        `svelte-vitals: unknown reporter '${argv.reporter}'. Valid values: console, json, agent, sarif, github.`
      );
    } else {
      reporter = argv.reporter;
    }
  }

  const failOnRaw = argv['fail-on'];
  const failOnValid = failOnRaw === 'warning' || failOnRaw === 'info' || failOnRaw === 'critical';
  if (typeof failOnRaw === 'string' && !failOnValid) {
    warnings.push(
      `svelte-vitals: unknown --fail-on '${failOnRaw}'; expected critical|warning|info. No threshold applied.`
    );
  }
  const failOn = argv['fail-on-warning'] ? 'warning' : failOnValid ? failOnRaw : undefined;

  if (errors.length > 0) return { options: null, warnings, errors };

  return {
    options: {
      cwd: positional ?? process.cwd(),
      metaComponents,
      treatDynamicAs,
      route,
      reporter,
      byRoute: Boolean(argv['by-route']),
      failOn,
      rules: buildRulesConfig(allow, ignore)
    },
    warnings,
    errors
  };
}
