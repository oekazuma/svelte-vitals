import type mri from 'mri';
import type { Category } from '@svelte-vitals/core';
import type { RunOptions } from './index.js';
import { buildRulesConfig, findUnknownRuleIds, knownRuleIds } from './rules-config.js';
import { isReporterName, type ReporterName } from './reporter-resolve.js';

const CATEGORIES: Category[] = ['seo', 'performance', 'correctness', 'security', 'architecture'];

/**
 * Parse `--weights seo=2,performance=1` into a per-category weight map
 * (design doc §6 / decision 6). Categories are matched case-insensitively and
 * normalized to lowercase; unknown categories and non-numeric/negative values
 * push fatal errors (mirrors the `--rules`/`--ignore` unknown-id error shape).
 * Returns `undefined` when `raw` is not a non-empty string (flag not passed).
 */
function parseWeights(raw: unknown, errors: string[]): Partial<Record<Category, number>> | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;

  const weights: Partial<Record<Category, number>> = {};
  const unknownCategories: string[] = [];
  const invalidValues: string[] = [];

  for (const pair of raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = pair.indexOf('=');
    if (eq === -1) {
      invalidValues.push(pair);
      continue;
    }
    const category = pair.slice(0, eq).trim().toLowerCase();
    const valueRaw = pair.slice(eq + 1).trim();
    if (!CATEGORIES.includes(category as Category)) {
      unknownCategories.push(category);
      continue;
    }
    // Reject an empty value explicitly — Number('') would silently coerce to 0.
    if (valueRaw === '') {
      invalidValues.push(pair);
      continue;
    }
    const value = Number(valueRaw);
    if (!Number.isFinite(value) || value < 0) {
      invalidValues.push(pair);
      continue;
    }
    weights[category as Category] = value;
  }

  if (unknownCategories.length > 0) {
    errors.push(`svelte-vitals: unknown category(ies) in --weights: ${unknownCategories.join(', ')}`);
    errors.push(`Known categories: ${CATEGORIES.join(', ')}`);
  }
  if (invalidValues.length > 0) {
    errors.push(
      `svelte-vitals: invalid --weights entry(ies): ${invalidValues.join(', ')}; expected category=number with a finite number >= 0.`
    );
  }

  return weights;
}

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

  // --diff (string): `--diff` alone → '' ⇒ default base 'HEAD'; `--diff main` → 'main'.
  const diffBase = typeof argv.diff === 'string' ? argv.diff || 'HEAD' : undefined;
  const staged = Boolean(argv.staged);

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
        `svelte-vitals: unknown reporter '${argv.reporter}'. Valid values: console, json, agent, sarif, github, html.`
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

  const weights = parseWeights(argv.weights, errors);

  // `buildRulesConfig` returns `{}` when neither --rules nor --ignore was passed;
  // normalize that to `undefined` so it doesn't clobber a config file's `rules`
  // (design doc §3, decision 3 — "not specified" must stay distinguishable from
  // "specified as empty").
  const rulesConfig = buildRulesConfig(allow, ignore);
  const rules = Object.keys(rulesConfig).length > 0 ? rulesConfig : undefined;

  if (errors.length > 0) return { options: null, warnings, errors };

  return {
    options: {
      cwd: positional ?? process.cwd(),
      metaComponents,
      treatDynamicAs,
      route,
      reporter,
      outFile: typeof argv['out-file'] === 'string' ? argv['out-file'] : undefined,
      byRoute: Boolean(argv['by-route']),
      failOn,
      rules,
      ...(weights !== undefined ? { weights } : {}),
      ...(diffBase !== undefined ? { diffBase } : {}),
      ...(staged ? { staged } : {})
    },
    warnings,
    errors
  };
}
