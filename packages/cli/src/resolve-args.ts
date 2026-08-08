import type { Category } from '@svelte-vitals/core';
import type { RunOptions } from './index.js';
import { parseCliArgs, toList, type CliArgv } from './cli-args.js';
import { findUnknownRuleIds, knownRuleIds } from './rules-config.js';
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

  for (const pair of toList(raw)) {
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

  // `raw` was a non-empty string (e.g. "," or " ") but every pair was either purely
  // whitespace (filtered out above, so neither unknownCategories nor invalidValues
  // saw it) or otherwise didn't yield an entry. Note: this check uses the local
  // unknownCategories/invalidValues counts, not `errors.length` — `errors` is the
  // shared diagnostics array for the whole resolveArgs() call and may already hold
  // unrelated entries (e.g. from --rules) by the time parseWeights runs. Without
  // this, a bare `--weights ,` would silently return {} and clobber a config
  // file's weights instead of surfacing a diagnostic.
  if (unknownCategories.length === 0 && invalidValues.length === 0 && Object.keys(weights).length === 0) {
    errors.push('svelte-vitals: --weights was passed but contains no category=number pairs.');
  }

  return weights;
}

/**
 * Parse `--category seo,SECURITY` into a de-duplicated list of categories
 * (mirrors `parseWeights`'s validation shape). Categories are matched
 * case-insensitively and normalized to lowercase; unknown categories push a
 * fatal error. Returns `undefined` when `raw` is not a non-empty string (flag
 * not passed).
 */
function parseCategories(raw: unknown, errors: string[]): Category[] | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined;

  const categories: Category[] = [];
  const unknownCategories: string[] = [];

  for (const entry of toList(raw).map((s) => s.toLowerCase())) {
    if (!CATEGORIES.includes(entry as Category)) {
      unknownCategories.push(entry);
      continue;
    }
    if (!categories.includes(entry as Category)) categories.push(entry as Category);
  }

  if (unknownCategories.length > 0) {
    errors.push(`svelte-vitals: unknown category(ies) in --category: ${unknownCategories.join(', ')}`);
    errors.push(`Known categories: ${CATEGORIES.join(', ')}`);
  }

  if (unknownCategories.length === 0 && categories.length === 0) {
    errors.push('svelte-vitals: --category was passed but contains no categories.');
  }

  return categories;
}

/** Result of normalizing parsed argv: the `run` options, plus any diagnostics to print. */
interface ResolvedArgs {
  /** Options to pass to `run`, or `null` when a fatal (exit-2) error was found. */
  options: RunOptions | null;
  /** Non-fatal messages (printed to stderr; analysis still proceeds). */
  warnings: string[];
  /** Fatal messages (printed to stderr; the CLI exits 2 without running). */
  errors: string[];
  /** Parsed `--min-health` value, when present and valid. */
  minHealth?: number;
}

// parseArgs (strict:false) lets a declared string flag consume a following
// flag token (`--route --staged` → route '--staged') and lets `--flag=` pass
// an empty string; either silently un-gates a CI run. Same stance as the
// --baseline guard below, applied to every value-carrying flag. --diff is
// exempt: bare/empty --diff deliberately defaults to HEAD (see parseRunArgs).
const VALUE_FLAGS = [
  'meta-components',
  'treat-dynamic-as',
  'route',
  'fail-on',
  'reporter',
  'rules',
  'ignore',
  'min-health',
  'out-file',
  'weights',
  'category'
] as const;

/** Parse the analysis command's argv, exactly as `main` (bin.ts) does — exported so tests share the real flag table. */
export function parseRunArgs(args: string[]): CliArgv {
  // --diff takes an optional value, which parseArgs cannot express: a bare --diff
  // (next token is another flag, or nothing) gets its default ref inlined here.
  const patched = args.map((a, i) => (a === '--diff' && (args[i + 1] ?? '--').startsWith('-') ? '--diff=HEAD' : a));
  return parseCliArgs(patched, {
    boolean: [
      'by-route',
      'staged',
      'score',
      'verbose',
      'update-suppressions',
      'no-suppressions',
      'no-color',
      'no-animation',
      'help',
      'version'
    ],
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
    ],
    short: { h: 'help', v: 'version' }
  });
}

/**
 * Normalize parsed CLI argv into `run` options without any I/O or process exit,
 * so the validation/warning behavior is unit-testable. `main` (in bin.ts) is the
 * thin wrapper that prints the diagnostics and maps a fatal result to exit code 2.
 */
export function resolveArgs(argv: CliArgv): ResolvedArgs {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const flag of VALUE_FLAGS) {
    const v = argv[flag];
    if (v !== undefined && (typeof v !== 'string' || v.trim() === '' || v.startsWith('-'))) {
      errors.push(`svelte-vitals: --${flag} requires a value.`);
    }
  }

  // --min-health lives here (not in bin.ts) so it shares the guard above. A bare/empty/
  // flag-shaped value is already an error by this point; this only adds range/numeric
  // validity on top, mirroring the other flags' own per-flag checks below.
  let minHealth: number | undefined;
  const minHealthRaw = argv['min-health'];
  if (minHealthRaw !== undefined) {
    const n = Number(minHealthRaw);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      errors.push(`svelte-vitals: invalid --min-health '${minHealthRaw}'; expected a number 0-100.`);
    } else {
      minHealth = n;
    }
  }

  const positional = argv._[0];
  const metaComponents = typeof argv['meta-components'] === 'string' ? toList(argv['meta-components']) : undefined;

  const treatRaw = argv['treat-dynamic-as'];
  const treatDynamicAs = treatRaw === 'warn' || treatRaw === 'fail' || treatRaw === 'pass' ? treatRaw : undefined;
  if (typeof treatRaw === 'string' && treatDynamicAs === undefined) {
    warnings.push(
      `svelte-vitals: unknown --treat-dynamic-as '${treatRaw}'; expected pass|warn|fail. Defaulting to 'pass'.`
    );
  }

  const route = typeof argv.route === 'string' ? argv.route : undefined;

  // --diff: a bare flag was rewritten to '--diff=HEAD' by parseRunArgs; `|| 'HEAD'`
  // still catches an explicit `--diff=`.
  const diffBase = typeof argv.diff === 'string' ? argv.diff || 'HEAD' : undefined;
  const staged = Boolean(argv.staged);

  // --baseline: unlike --diff, no implicit default — a bare `--baseline` (parseArgs
  // yields `true`) is a fatal error rather than silently defaulting to HEAD, so a
  // missing ref in a CI config surfaces immediately instead of silently no-op'ing.
  // Values starting with '-' are rejected too: git refnames cannot start with '-',
  // and parseArgs would otherwise consume a following flag (`--baseline --force`)
  // as the ref, turning a misconfigured CI gate into a silent pass.
  let baselineRef: string | undefined;
  if (argv.baseline !== undefined) {
    if (typeof argv.baseline !== 'string' || argv.baseline.trim() === '' || argv.baseline.startsWith('-')) {
      errors.push('svelte-vitals: --baseline requires a git ref (e.g. --baseline origin/main).');
    } else {
      baselineRef = argv.baseline;
    }
  }

  const allow = toList(argv.rules);
  const ignore = toList(argv.ignore);
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    errors.push(`svelte-vitals: unknown rule id(s) in --rules/--ignore: ${unknown.join(', ')}`);
    errors.push(`Known rule ids: ${knownRuleIds().join(', ')}`);
  }

  let reporter: ReporterName | undefined;
  if (typeof argv.reporter === 'string') {
    if (!isReporterName(argv.reporter)) {
      errors.push(
        `svelte-vitals: unknown reporter '${argv.reporter}'. Valid values: console, json, agent, sarif, github, html, md.`
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
  const failOn = failOnValid ? failOnRaw : undefined;

  const weights = parseWeights(argv.weights, errors);
  const categories = parseCategories(argv.category, errors);

  const score = Boolean(argv.score);
  if (score && typeof argv.reporter === 'string') {
    warnings.push('svelte-vitals: --score overrides --reporter; reporter output suppressed.');
  }

  const verbose = Boolean(argv['verbose']);

  const noColor = Boolean(argv['no-color']);
  const noAnimation = Boolean(argv['no-animation']);
  const noSuppressions = Boolean(argv['no-suppressions']);
  const updateSuppressions = Boolean(argv['update-suppressions']);
  if (updateSuppressions && noSuppressions) {
    errors.push('svelte-vitals: --update-suppressions and --no-suppressions cannot be used together.');
  }

  // Both flags are selection, and both travel as id lists: `--rules` names what runs and
  // `--ignore` names what does not, and neither says anything about how the rules it leaves
  // enabled are configured. Synthesizing a `rules` map here is what made selection depend on the
  // absence of an entry, which a config file's own map could not survive (design 2026-08-06).
  // Both an omitted flag and an empty list collapse to `undefined` here — fine, since
  // `resolveRuleSelection` treats an empty list as no narrowing anyway.
  const allowRules = allow.length > 0 ? allow : undefined;
  const ignoreRules = ignore.length > 0 ? ignore : undefined;

  if (errors.length > 0) return { options: null, warnings, errors };

  return {
    options: {
      cwd: positional ?? process.cwd(),
      // Never reinterpret an explicit target (design doc 2026-07-08-monorepo-app-picker-design.md,
      // decision 1): the monorepo picker in run() only triggers when this is false.
      explicitPath: positional !== undefined,
      metaComponents,
      treatDynamicAs,
      route,
      reporter,
      outFile: typeof argv['out-file'] === 'string' ? argv['out-file'] : undefined,
      byRoute: Boolean(argv['by-route']),
      failOn,
      ...(allowRules !== undefined ? { allowRules } : {}),
      ...(ignoreRules !== undefined ? { ignoreRules } : {}),
      ...(weights !== undefined ? { weights } : {}),
      ...(categories !== undefined ? { categories } : {}),
      ...(score ? { score } : {}),
      ...(verbose ? { verbose } : {}),
      ...(noColor ? { noColor } : {}),
      ...(noAnimation ? { noAnimation } : {}),
      ...(diffBase !== undefined ? { diffBase } : {}),
      ...(staged ? { staged } : {}),
      ...(baselineRef !== undefined ? { baseline: baselineRef } : {}),
      ...(noSuppressions ? { noSuppressions } : {}),
      ...(updateSuppressions ? { updateSuppressions } : {})
    },
    warnings,
    errors,
    minHealth
  };
}
