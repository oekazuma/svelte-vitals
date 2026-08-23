import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import { run } from '../index.js';
import { readPackageVersion, readCoreVersion } from '../version.js';
import { parseRunArgs, resolveArgs, VALUE_FLAGS, type CliArgv } from '../resolve-args.js';
import { selectAppPrompt } from '../install/cli.js';
import { consoleIO, type CliIO } from '../cli-io.js';
import type { CliResult } from '../cli.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, suggestClosest } from './guard.js';
import { localizedOptionsSection, type Locale } from './locale.js';

/**
 * `runCli` (cli.ts)'s reserved first-token dispatch names, hand-kept in sync (five short, stable
 * tokens) — used only for the `did-you-mean` hint below on an explicit path that resolves to
 * nothing on disk, e.g. `svelte-vitals isntall`; an existing directory of the same name is always
 * analyzed as-is, never redirected (see the `existsSync` check at its one call site).
 */
const KNOWN_TOP_LEVEL_SUBCOMMANDS = ['docs', 'explain', 'install', 'ci', 'complete'];

const VERSION = readPackageVersion();

/** Monorepo app picker (design doc 2026-07-08-monorepo-app-picker-design.md): single-select via @clack/prompts, same style as the `install` wizard. */
function selectApp(apps: string[]): Promise<string | null> {
  return selectAppPrompt(apps, 'Multiple SvelteKit apps found — which one should svelte-vitals analyze?');
}

/**
 * Every boolean flag the analyzer declares, kebab-cased — mirrors `parseRunArgs`'s own
 * `boolean: [...]` list (resolve-args.ts) so guard.ts's last-wins `--flag=false` normalization
 * covers exactly the same set gunshi will parse as booleans.
 */
const BOOLEAN_FLAGS = [
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
] as const;

/**
 * gunshi's renderer treats ANY arg key literally starting with `no-` as an auto-generated
 * negation of a base flag (stripping the prefix and looking up `ctx.args[stripped]`), regardless
 * of whether `negatable: true` was set — confirmed empirically (`node_modules/@gunshi/docs` does
 * not document this). For `no-suppressions`/`no-color`/`no-animation`, that base flag doesn't
 * exist, so the renderer falls back to printing the stripped key itself ("suppressions", "color",
 * "animation") instead of our description. Declaring these three under a camelCase key + `toKebab:
 * true` sidesteps the string-prefix check entirely while still parsing/rendering as `--no-*` on
 * the command line (`toKebab` affects both, per ArgSchema's docs) — `ctx.values` then carries them
 * under their camelCase key, remapped back to the kebab name `resolveArgs` expects in `toCliArgv`
 * below.
 */
/** Exported for gunshi/complete.ts — the completion tree's root args mirror this, never a second copy. */
export const ROOT_ARGS = {
  'meta-components': { type: 'string', description: 'Comma-separated component names that emit head metadata' },
  'treat-dynamic-as': { type: 'string', description: 'pass | warn | fail (default: pass)' },
  route: { type: 'string', description: 'Only analyze routes matching this glob' },
  diff: {
    type: 'string',
    description: 'Report only findings in files changed vs ref (default HEAD; e.g. --diff main)'
  },
  staged: { type: 'boolean', description: 'Report only findings in files staged for commit (pre-commit gate)' },
  baseline: {
    type: 'string',
    description: 'Report only findings not present at ref (compare against e.g. origin/main)'
  },
  'update-suppressions': {
    type: 'boolean',
    description:
      'Write svelte-vitals-suppressions.json accepting all current findings (introduce gates on legacy projects)'
  },
  noSuppressions: {
    type: 'boolean',
    toKebab: true,
    description: 'Ignore svelte-vitals-suppressions.json for this run'
  },
  'by-route': { type: 'boolean', description: 'Show per-route score breakdown in console output' },
  reporter: {
    type: 'string',
    description:
      'console | json | agent | sarif | github | html | md (auto: agent under AI-agent envs, github under GitHub Actions)'
  },
  'out-file': {
    type: 'string',
    description: "Output path for --reporter html (default: svelte-vitals-report.html; '-' for stdout)"
  },
  'fail-on': {
    type: 'string',
    description: 'Fail (exit 1) when any finding reaches this severity: critical | warning | info'
  },
  'min-health': {
    type: 'string',
    description: 'Fail (exit 1) when the combined Health score is below this value (0-100)'
  },
  rules: { type: 'string', description: 'Comma-separated rule ids to enable (all others disabled)' },
  config: {
    type: 'string',
    description: 'Path to a config file to use instead of the one in the analyzed directory'
  },
  ignore: { type: 'string', description: 'Comma-separated rule ids to disable' },
  category: {
    type: 'string',
    description:
      'Comma-separated categories to analyze: seo | performance | correctness | security | architecture | a11y'
  },
  weights: {
    type: 'string',
    description: 'Per-category Health weight overrides, e.g. seo=2,performance=1 (unlisted categories default to 1)'
  },
  score: { type: 'boolean', description: 'Print only the combined Health score (works with --min-health for gating)' },
  noColor: { type: 'boolean', toKebab: true, description: 'Disable ANSI color in console output' },
  noAnimation: {
    type: 'boolean',
    toKebab: true,
    description: 'Disable the Health-score reveal animation and mascot on an interactive terminal'
  },
  verbose: {
    type: 'boolean',
    description: 'Show every finding uncapped and ungrouped (default: capped, grouped by rule)'
  },
  help: { type: 'boolean', short: 'h', description: 'Show this help' },
  version: { type: 'boolean', short: 'v', description: 'Show version' }
} as const;

/** Long flag names gunshi is declared to recognize, kebab-cased as they appear on argv — see `stripUnknownFlags`. */
const KNOWN_LONG_FLAGS = new Set<string>([
  ...Object.keys(ROOT_ARGS).filter((k) => k !== 'noColor' && k !== 'noAnimation' && k !== 'noSuppressions'),
  'no-color',
  'no-animation',
  'no-suppressions'
]);
const KNOWN_SHORT_FLAGS = new Set(['h', 'v']);

/**
 * Rewrites a bare `--diff`/`--baseline` (follower missing or dash-leading, judged on THIS argv's
 * own adjacency — called with the original argv, before anything strips a token that sat between
 * them and a real value) into a self-contained `--flag=value` token. Purely for the copy of argv
 * gunshi parses: gunshi's own diff/baseline values are discarded either way —
 * `shadowParseDiffAndBaseline`, run separately against the untouched original argv, stays the sole
 * source of truth for both. Without this, `guard.ts`'s `stripUnknownFlags` removing an unknown
 * flag that sat between a bare `--diff`/`--baseline` and a following positional would expose that
 * positional to gunshi's own (otherwise-discarded) parse, which consumes it as the flag's value
 * instead of leaving it as the analyzed path. The value gunshi lands on doesn't matter (`HEAD` for
 * diff, empty for baseline): either is dropped in favor of the shadow parse.
 */
function neutralizeBareDiffAndBaseline(argv: string[]): string[] {
  return argv.map((token, i) => {
    const bare = (argv[i + 1] ?? '--').startsWith('-');
    if (token === '--diff' && bare) return '--diff=HEAD';
    if (token === '--baseline' && bare) return '--baseline=';
    return token;
  });
}

/**
 * Builds the hybrid `--help` text: hand-written header/usage + sub-commands stay prose (gunshi has
 * no subCommands map here to generate them from); the options list is generated from `ROOT_ARGS`,
 * ja-localized when `locale` is 'ja' (`docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`).
 * `./locales/ja.js` (several KB of Japanese strings) is imported dynamically, only on the `ja`
 * branch — this function, and therefore that import, only ever runs for an actual `--help`
 * invocation, but `analyze.ts` itself is on the analyzer's hot path (statically imported by
 * `cli.ts` for every invocation), so a static import here would cost every plain analyze run too.
 */
async function buildHelpText(rootCommand: Parameters<typeof generate>[1], locale: Locale): Promise<string> {
  if (locale === 'ja') {
    const { JA_ARG_DESCRIPTIONS, rootHelpJa } = await import('./locales/ja.js');
    const optionsSection = await localizedOptionsSection(
      rootCommand,
      'svelte-vitals',
      locale,
      JA_ARG_DESCRIPTIONS.root
    );
    return rootHelpJa(optionsSection);
  }

  const optionsSection = await localizedOptionsSection(rootCommand, 'svelte-vitals', locale, {});

  return `svelte-vitals — a deterministic SvelteKit code-health scanner (SEO · performance · correctness · security · architecture · accessibility)

Usage:
  svelte-vitals [path] [options]
  svelte-vitals docs list        List the bundled guides (docs show <name> prints one)
  svelte-vitals explain --list   List every rule (explain <rule-id> explains one)
  svelte-vitals install          Set up the Vite integration, Cursor rules, config file, or CI
  svelte-vitals ci install       Add a GitHub Actions PR gate (annotations + summary comment)
  svelte-vitals ci upgrade       Refresh the pinned @svelte-vitals/action in an existing workflow
  svelte-vitals complete <shell> Print a shell completion script (bash, zsh, fish, powershell)

${optionsSection}

Config file:
  svelte-vitals.config.{js,ts} in the analyzed directory; flags override it.

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
}

/**
 * `--diff`/`--baseline` are exempt from `guardArgs`'s VALUE_FLAGS class (design doc: `--diff`
 * defaults rather than rejects; `--baseline` gets its own dedicated `resolveArgs` wording) but
 * gunshi's args-tokens drops ANY missing/empty/flag-following value on a string arg to
 * `undefined` (not just the empty-value case VALUE_FLAGS guards against) — confirmed empirically
 * for both flags. Re-parsing just these two with the same `node:util`-backed parser
 * `resolveArgs`'s checks were built against reproduces today's exact value shapes (`true` for a
 * bare trailing flag, `''` for `--flag=`, a consumed flag-like token for `--flag --other`)
 * without touching `resolve-args.ts` at all. Takes the ORIGINAL argv, not the
 * `stripUnknownFlags`-adjusted copy fed to gunshi: `--baseline --typo main` needs `--typo` still
 * present so this parse consumes it (dash-prefixed) as baseline's value and `resolveArgs`
 * rejects it, exactly as `parseRunArgs` does today — dropping `--typo` first would let `main`
 * become baseline's value instead, turning today's fatal error into a silent pass.
 *
 * Inlined rather than routed through `parseRunArgs` (Phase 3 deletion pass, design doc addendum):
 * only `diff`/`baseline` are needed here, so the two-flag `node:util.parseArgs` call is
 * self-contained instead of pulling in the analyzer's whole flag table.
 */
export function shadowParseDiffAndBaseline(argv: string[]): { diff: unknown; baseline: unknown } {
  const patched = argv.map((a, i) => (a === '--diff' && (argv[i + 1] ?? '--').startsWith('-') ? '--diff=HEAD' : a));
  const { values } = parseArgs({
    args: patched,
    options: { diff: { type: 'string' }, baseline: { type: 'string' } },
    strict: false,
    allowPositionals: true
  });
  return { diff: values.diff, baseline: values.baseline };
}

/** Adapts gunshi's parsed result into the `CliArgv` shape `resolveArgs` consumes, unchanged. */
function toCliArgv(values: Record<string, unknown>, positionals: string[], rawArgs: string[]): CliArgv {
  const { diff, baseline } = shadowParseDiffAndBaseline(rawArgs);
  return {
    _: positionals,
    ...values,
    'no-color': values.noColor,
    'no-animation': values.noAnimation,
    'no-suppressions': values.noSuppressions,
    diff,
    baseline
  };
}

/**
 * gunshi/bone port of the root analyzer's dispatch (design doc: Phase 2b). A single entry with no
 * `subCommands` map — `runCli` (cli.ts) keeps its own exact-match branches for `docs`/`explain`/
 * `install`/`ci`, so an unmatched first token (`./docs`, a path) reaches this file's `run()`
 * directly. See docs.ts/explain.ts for the exit-code closure and injected-`CliIO` pattern this
 * mirrors.
 */
export async function runAnalyzeCliGunshi(
  args: string[],
  io: CliIO = consoleIO,
  locale: Locale = 'en'
): Promise<CliResult> {
  // `--` must be split off before any of guard/neutralize/strip run: none of them understands the
  // terminator, so a post-`--` token that merely looks like a flag (`<path> -- --score`) would
  // otherwise get reinterpreted as a real one — `tail` is appended verbatim to the positional
  // channel below, never touched by anything flag-shaped again.
  const { head, tail } = splitAtTerminator(args);
  // Pre-neutralizing (not `head` itself — VALUE_FLAGS never includes diff/baseline, so guard's own
  // error detection is unaffected either way) keeps a bare `--diff`/`--baseline`'s adjacency
  // judged on the true pre-`--` argv, before guard's own `--flag=false` stripping could shift what
  // sits next to them.
  const guard = guardArgs(neutralizeBareDiffAndBaseline(head), VALUE_FLAGS, BOOLEAN_FLAGS);
  const argvForGunshi = stripUnknownFlags(guard.argv, KNOWN_LONG_FLAGS, KNOWN_SHORT_FLAGS);

  let result: CliResult = { code: 0, exit: 'natural' };

  const rootCommand = define({
    name: 'svelte-vitals',
    args: ROOT_ARGS,
    run: async (ctx) => {
      if (ctx.values.help) {
        io.log(await buildHelpText(rootCommand, locale));
        result = { code: 0, exit: 'natural' };
        return;
      }
      if (ctx.values.version) {
        // Printing the resolved core version alongside the CLI's own lets users compare
        // it directly against the `@svelte-vitals/vite` live dashboard's "core vX.Y.Z" line —
        // the two packages are versioned independently and can drift (see docs).
        io.log(`${VERSION} (core ${readCoreVersion()})`);
        // stdout stays exactly the version string so it can be parsed; the pointer goes to stderr.
        // An agent that runs only `--version` and never `--help` still learns the guides exist.
        io.errorLog('svelte-vitals: run `svelte-vitals docs list` for the bundled guides.');
        result = { code: 0, exit: 'natural' };
        return;
      }

      if (guard.errors.length > 0) {
        // gunshi's parser can't reject these post-parse (guard.ts's own doc comment) — fall back
        // to the exact legacy parse/validate pair so the printed diagnostics (guard's own wording
        // PLUS resolveArgs' enum/range checks, which also fire against the same raw value) match
        // byte-for-byte, in the same order, as today.
        const { warnings, errors } = resolveArgs(parseRunArgs(args));
        for (const w of warnings) io.errorLog(w);
        for (const e of errors) io.errorLog(e);
        result = { code: 2, exit: 'immediate' };
        return;
      }

      // `tail` (post-`--`) never went through gunshi — it was split off above and stays out of
      // `ctx.positionals` entirely, so it's appended here, verbatim, as node's `parseArgs` would.
      const argv = toCliArgv(ctx.values as Record<string, unknown>, [...(ctx.positionals as string[]), ...tail], args);
      const { options, warnings, errors, minHealth } = resolveArgs(argv);
      for (const w of warnings) io.errorLog(w);
      for (const e of errors) io.errorLog(e);
      if (!options) {
        result = { code: 2, exit: 'immediate' };
        return;
      }

      // Computed before the run — never after — so a coincidental match against something the
      // analysis itself printed (a finding, a rule id) can't masquerade as a subcommand typo.
      // Gated on the path not existing at all: an explicit path that IS a real directory is
      // analyzed as the user asked, even if its name happens to resemble a subcommand.
      // `options.cwd` is optional only in `RunOptions`'s general shape (embedding callers may omit
      // it); `resolveArgs` itself always fills it in (`positional ?? process.cwd()`).
      const explicitCwd = options.cwd ?? process.cwd();
      const suggestedSubcommand =
        options.explicitPath && !existsSync(explicitCwd)
          ? suggestClosest(explicitCwd, KNOWN_TOP_LEVEL_SUBCOMMANDS)
          : undefined;

      const code = await run({
        ...options,
        minHealth,
        selectApp,
        log: io.log,
        errorLog: io.errorLog
      });
      // `options.cwd` not existing on disk forces `detectProject` to throw `ProjectError` (every
      // check it runs needs a file under that path), so this is the one message `run()` could have
      // just printed — appended, never replacing it (design doc invariants).
      if (suggestedSubcommand !== undefined && code === 2) {
        io.errorLog(`svelte-vitals: did you mean \`svelte-vitals ${suggestedSubcommand}\`?`);
      }
      // A write to a pipe is asynchronous, so `process.exit` can discard what has not drained — the report is
      // the largest thing this CLI writes and the first pipe buffer is 65,536 bytes. The empty write's callback
      // fires once the stream has flushed, so it's safe for the thin entry to call `process.exit` as soon as
      // this resolves.
      await new Promise((resolve) => process.stdout.write('', resolve));
      result = { code, exit: 'immediate' };
    }
  });

  await cli(argvForGunshi, rootCommand, {
    name: 'svelte-vitals',
    // Routes every internal gunshi write through a no-op — see docs.ts's identical note; bone has
    // no renderer plugin installed so nothing here currently relies on it, kept for forward-compat.
    usageSilent: true
  });

  return result;
}
