import { cli } from 'gunshi/bone';
import { define, type ArgSchema, type Args } from 'gunshi/definition';
import { kebabnize } from 'gunshi/utils';
import completion from '@gunshi/plugin-completion';
import { consoleIO, type CliIO } from '../cli-io.js';
import { REPORTER_NAMES } from '../reporter-resolve.js';
import { CATEGORIES, FAIL_ON_VALUES, TREAT_DYNAMIC_AS_VALUES } from '../resolve-args.js';
import { ROOT_ARGS } from './analyze.js';
import { DOCS_ROOT_ARGS, DOCS_LIST_ARGS, DOCS_SHOW_ARGS } from './docs.js';
import { EXPLAIN_ARGS } from './explain.js';
import { INSTALL_ARGS } from './install.js';
import { CI_ARGS, CI_UPGRADE_ARGS } from './ci.js';

const SUPPORTED_SHELLS = ['bash', 'zsh', 'fish', 'powershell'] as const;

/**
 * `@gunshi/plugin-completion` registers a flag directly off its declaring object's key, with no
 * awareness of `toKebab`/`hidden` (confirmed empirically against 0.37.1: a `toKebab: true`
 * camelCase key like `noSuppressions` is offered verbatim as `--noSuppressions` — which the real
 * CLI does not parse — instead of `--no-suppressions`; a `hidden: true` entry like install's
 * obsolete `scope` is still offered). Mirrors an args record into a completion-safe copy —
 * key-corrected, hidden entries dropped, multi-line descriptions collapsed to one line (a raw
 * `\n` inside a candidate's description breaks the line-oriented `value\tdescription` protocol,
 * turning each continuation line into its own bogus candidate) — never a second copy of the
 * flags/descriptions themselves, which stay the imported consts from each surface's own module.
 *
 * Separately: the plugin resolves a `no-*` key's OWN description by stripping the prefix and
 * looking up the base key in this same args record (confirmed empirically — its `localizable()`
 * does this unconditionally, independent of the `toKebab` workaround above, which only sidesteps
 * gunshi's *help renderer* doing the same stripping). None of `no-suppressions`/`no-color`/
 * `no-animation` has a real base flag, so the plugin falls back to printing the bare stripped key
 * ("color") instead of our description. A `type: 'positional'` phantom entry under the stripped
 * name satisfies that lookup without becoming a real candidate itself: bomb.sh/tab only lists
 * `.options` entries (registered from non-positional schemas) as flag candidates, and this
 * phantom carries no completion handler, so it contributes none of its own.
 */
function forCompletion(args: Args): Args {
  const out: Record<string, ArgSchema> = {};
  for (const [key, schema] of Object.entries(args)) {
    if (schema.hidden) continue;
    const outKey = schema.type === 'positional' || !schema.toKebab ? key : kebabnize(key);
    const description = schema.description?.replace(/\s*\n\s*/g, ' ');
    out[outKey] = description === schema.description ? schema : { ...schema, description };
  }
  for (const [key, schema] of Object.entries(out)) {
    const stripped = key.startsWith('no-') ? key.slice(3) : undefined;
    if (stripped && !(stripped in out)) {
      out[stripped] = { type: 'positional', required: false, description: schema.description };
    }
  }
  return out;
}

/** A completion value-handler for a fixed list, e.g. `--reporter`'s console/json/agent/... set. */
function valueList(list: readonly string[], describe: Record<string, string> = {}) {
  return { handler: () => list.map((value) => ({ value, description: describe[value] ?? '' })) };
}

/**
 * Builds the completion-only command tree — mirrors the five real gunshi surfaces' `subCommands`
 * shape (`docs list`/`show`, `ci install`/`upgrade`) using ONLY their exported `*_ARGS` consts, so
 * a flag added to a real surface is visible here automatically and a flag never gets a second,
 * drifting declaration. Every `run` is a no-op: `@gunshi/plugin-completion` never executes these
 * commands — it only reads `.args`/`.subCommands` during its `onExtension` hook. The command
 * actually dispatched for a `complete` invocation is the `complete` sub-command the plugin adds
 * itself via `ctx.addCommand` (confirmed empirically — see `runCompleteCliGunshi` below).
 *
 * Built fresh per call, matching every other ported surface's race-safety convention (docs.ts's
 * own doc comment): `completion()` closes over one `@bomb.sh/tab` `RootCommand` instance per call,
 * so two concurrent invocations sharing a module-level plugin instance could race registering
 * commands into it.
 */
function buildCompletionTree() {
  const listCommand = define({ name: 'list', args: forCompletion(DOCS_LIST_ARGS), run: () => {} });
  const showCommand = define({ name: 'show', args: forCompletion(DOCS_SHOW_ARGS), run: () => {} });
  const docsCommand = define({
    name: 'docs',
    args: forCompletion(DOCS_ROOT_ARGS),
    subCommands: { list: listCommand, show: showCommand },
    run: () => {}
  });
  const explainCommand = define({ name: 'explain', args: forCompletion(EXPLAIN_ARGS), run: () => {} });
  const installCommand = define({ name: 'install', args: forCompletion(INSTALL_ARGS), run: () => {} });
  const ciInstallCommand = define({ name: 'install', args: forCompletion(CI_ARGS), run: () => {} });
  const ciUpgradeCommand = define({ name: 'upgrade', args: forCompletion(CI_UPGRADE_ARGS), run: () => {} });
  const ciCommand = define({
    name: 'ci',
    args: {},
    subCommands: { install: ciInstallCommand, upgrade: ciUpgradeCommand },
    run: () => {}
  });
  const rootCommand = define({ name: 'svelte-vitals', args: forCompletion(ROOT_ARGS), run: () => {} });

  // Only the root analyzer's flags take a fixed, enum-ish value set worth completing — matches
  // the descriptions already used in docs/src/content/docs/guides/(setup)/cli.md's flag tables.
  const completionPlugin = completion({
    config: {
      entry: {
        args: {
          reporter: valueList(REPORTER_NAMES, {
            console: 'Human-readable text output (default)',
            json: 'Machine-readable JSON',
            agent: 'Markdown remediation for AI coding agents',
            sarif: 'SARIF v2.1 (GitHub Code Scanning / SAST)',
            github: 'GitHub Actions annotation format',
            html: 'Self-contained HTML report',
            md: 'Compact Markdown summary for PR comments / job summaries'
          }),
          'fail-on': valueList(FAIL_ON_VALUES, {
            critical: 'Fail only on critical findings',
            warning: 'Fail on warning or critical findings',
            info: 'Fail on any finding'
          }),
          category: valueList(CATEGORIES),
          'treat-dynamic-as': valueList(TREAT_DYNAMIC_AS_VALUES, {
            pass: 'Dynamic values pass (default)',
            warn: 'Dynamic values produce a warning',
            fail: 'Dynamic values are treated as missing'
          })
        }
      }
    }
  });

  return {
    rootCommand,
    subCommands: { docs: docsCommand, explain: explainCommand, install: installCommand, ci: ciCommand },
    completionPlugin
  };
}

/**
 * gunshi/bone port wiring `@gunshi/plugin-completion` (design doc addendum, this PR). Unlike every
 * other ported surface, `args` reaches `cli()` completely unguarded/unstripped: `--` here is not
 * this CLI's own terminator convention — it is the plugin's own protocol marker separating
 * "print a setup script for this shell" (`complete <shell>`) from "return completion candidates
 * for these words" (`complete -- <word>...`, what the generated script itself calls back with) —
 * and the plugin's `complete` command reads argv straight off `ctx._` (the raw array passed to
 * `cli()`), never through args-tokens parsing. So `runCli` (cli.ts) hands this function the FULL
 * argv, `complete` included — slicing it off like every other branch does would leave `ctx._[1]`
 * pointing at the wrong token and the plugin would silently produce no output.
 *
 * `shell`/`--` are validated before `cli()` even runs: an unsupported or missing shell would
 * otherwise reach the plugin's own `assert(...)` in `@bomb.sh/tab`'s `setup()` (an uncaught throw)
 * or silently print just the bare directive line with no candidates — this CLI's only
 * would-be-silent-failure surface otherwise.
 */
export async function runCompleteCliGunshi(args: string[], io: CliIO = consoleIO): Promise<number> {
  const shell = args[1];
  const isCallback = shell === '--';
  const isKnownShell = typeof shell === 'string' && (SUPPORTED_SHELLS as readonly string[]).includes(shell);
  if (!isCallback && !isKnownShell) {
    io.errorLog(
      shell === undefined
        ? 'svelte-vitals: complete needs a shell name, e.g. `svelte-vitals complete zsh`.'
        : `svelte-vitals: unknown shell '${shell}'.`
    );
    io.errorLog(`svelte-vitals: supported shells: ${SUPPORTED_SHELLS.join(', ')}.`);
    return 2;
  }

  const { rootCommand, subCommands, completionPlugin } = buildCompletionTree();
  await cli(args, rootCommand, {
    name: 'svelte-vitals',
    subCommands,
    fallbackToEntry: true,
    usageSilent: true,
    plugins: [completionPlugin]
  });
  return 0;
}
