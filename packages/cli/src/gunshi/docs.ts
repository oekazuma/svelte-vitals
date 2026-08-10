import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { docsUrlFor } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
import { EMBEDDED_DOCS } from '../docs/generated.js';
import { DOCS_HELP, knownTopicNames, renderList } from '../docs/cli.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags } from './guard.js';

/** docs declares no value-carrying flags today — see guard.ts's own doc comment for why the list is still passed explicitly. */
const BOOLEAN_FLAGS = ['json', 'help'] as const;
const HELP_ARG = { help: { type: 'boolean', short: 'h' } } as const;
/** Family-wide, not per-subcommand — see guard.ts's `stripUnknownFlags` doc comment: the legacy
 * runner parses `--json`/`-h`/`--help` in one flat pass, so `show` (which never reads `--json`
 * itself) still needs it declared below to keep gunshi's own per-command resolution from
 * mistaking it for an unknown flag and swallowing the positional after it. */
const KNOWN_LONG_FLAGS = new Set(BOOLEAN_FLAGS);
const KNOWN_SHORT_FLAGS = new Set(['h']);

/**
 * gunshi/bone port of `docs/cli.ts`'s dispatch (design doc: Phase 2a). `docs` is passed as its
 * own `cli()` entry (not nested under a shared root) so an unmatched sub-command token reaches
 * this file's own root `run()` via `fallbackToEntry` directly — reproducing
 * `unknown docs subcommand '<x>'` verbatim without having to catch and re-render gunshi's own
 * `CommandNotFoundError`, which is what nesting `docs` under a shared entry would require (that
 * error only carries `commandPath`/`candidates` at the *intermediate* level, not the entry level;
 * see the exit-code closure note below for the other half of why this shape was chosen).
 *
 * Exit codes have no return-value channel in gunshi (`executeCommand` discards a non-string
 * runner return) — `exitCode` is the closure every `run` below sets instead. Commands are built
 * fresh on every call (not module-level singletons) so concurrent invocations can't race across
 * `cli()`'s internal `await`s and clobber each other's closure.
 */
export async function runDocsCliGunshi(args: string[], io: CliIO = consoleIO): Promise<number> {
  // `--` must be split off before guard/strip run — see guard.ts's `splitAtTerminator` doc
  // comment. `tail` is appended verbatim to every positional read below.
  const { head, tail } = splitAtTerminator(args);
  const guard = guardArgs(head, [], BOOLEAN_FLAGS);
  for (const e of guard.errors) io.errorLog(e);
  if (guard.errors.length > 0) return 2;
  const argvForGunshi = stripUnknownFlags(guard.argv, KNOWN_LONG_FLAGS, KNOWN_SHORT_FLAGS);

  // Legacy's `[sub, ...rest] = argv._` picks the sub-command from ONE merged positional list, in
  // argv order regardless of `--` — so `docs -- list` still sees `sub === 'list'`. gunshi can't:
  // only `head` ever reaches its own sub-command matching (`tail` never goes through `cli()` at
  // all), so when head has no positional of its own, gunshi immediately falls back to root's
  // `run()` — which can only report "unknown subcommand", never actually dispatch to `list`/
  // `show`'s own logic. Promoting the one matching token out of `tail` into the head argv lets
  // gunshi's real matching route to it. Gated on head having NO positional at all (not merely a
  // non-matching one): if head already attempted a positional, THAT is what `argv._[0]` would
  // have been under the legacy parser, and tail is left alone — root's fallback below already
  // merges it in for that "unknown subcommand" wording.
  const headHasPositional = argvForGunshi.some((t) => !t.startsWith('-'));
  const promoted = !headHasPositional && (tail[0] === 'list' || tail[0] === 'show');
  const finalArgv = promoted ? [...argvForGunshi, tail[0]!] : argvForGunshi;
  const tailRest = promoted ? tail.slice(1) : tail;

  let exitCode = 0;

  const listCommand = define({
    name: 'list',
    args: { json: { type: 'boolean' }, ...HELP_ARG },
    run: (ctx) => {
      if (ctx.values.help) {
        io.log(DOCS_HELP);
        exitCode = 0;
        return;
      }
      // ctx.positionals is NOT "args after `list`" — for a matched sub-command it's the raw
      // top-level positional array with the command-path token(s) spliced in at the front
      // (undocumented; see the regression test pinning this). Slicing off commandPath.length
      // recovers "args after the sub-command name"; `tail` (post-`--`) never went through gunshi
      // at all, so it's appended here rather than being part of that slice.
      const extra = [...ctx.positionals.slice(ctx.commandPath.length), ...tailRest];
      if (extra.length > 0) {
        // Accepting it would read as "list, filtered to config".
        io.errorLog('svelte-vitals: docs list takes no arguments; use `docs show <name>` to read one.');
        exitCode = 2;
        return;
      }
      io.log(
        ctx.values.json
          ? JSON.stringify(
              EMBEDDED_DOCS.map((d) => ({ name: d.name, title: d.title, description: d.description })),
              null,
              2
            )
          : renderList()
      );
      exitCode = 0;
    }
  });

  const showCommand = define({
    name: 'show',
    args: {
      // Left un-required on purpose: gunshi's own "required positional missing" validation
      // error preempts this command's `run` entirely and can't be made to say
      // "docs show needs a topic name, e.g. ...". Counting positionals ourselves reproduces
      // the exact current wording instead.
      name: { type: 'positional', required: false },
      // Declared but unused here — see the family-wide KNOWN_LONG_FLAGS comment above. The legacy
      // runner accepts `--json` on `show` too (a harmless no-op boolean); without this, gunshi's
      // per-command resolution would treat `--json` as undeclared for `show` specifically and
      // swallow the following positional (`docs show --json config` would lose `config`).
      json: { type: 'boolean' },
      ...HELP_ARG
    },
    run: (ctx) => {
      if (ctx.values.help) {
        io.log(DOCS_HELP);
        exitCode = 0;
        return;
      }
      // `docs show a b` printing only `a` would misrepresent itself as "here are both".
      const rest = [...ctx.positionals.slice(ctx.commandPath.length), ...tailRest];
      if (rest.length !== 1) {
        io.errorLog(
          rest.length === 0
            ? 'svelte-vitals: docs show needs a topic name, e.g. `svelte-vitals docs show config`.'
            : 'svelte-vitals: docs show takes one topic at a time.'
        );
        io.errorLog(`svelte-vitals: known topics: ${knownTopicNames()}.`);
        exitCode = 2;
        return;
      }
      const name = rest[0]!; // rest.length === 1, checked above
      const doc = EMBEDDED_DOCS.find((d) => d.name === name);
      if (!doc) {
        // The agent reporter and web docs print rule ids as `<category>/<slug>` (and the web
        // path as `rules/<category>/<slug>`); redirect those to `explain` instead of the
        // generic "unknown topic" list, which does not include rule ids at all.
        const ruleId = name.startsWith('rules/') ? name.slice('rules/'.length) : name;
        if (knownRuleIds().includes(ruleId)) {
          io.errorLog(`svelte-vitals: '${ruleId}' is a rule, not a docs topic.`);
          io.errorLog(`svelte-vitals: rule detail: \`svelte-vitals explain ${ruleId}\`; web: ${docsUrlFor(ruleId)}`);
          exitCode = 2;
          return;
        }
        io.errorLog(`svelte-vitals: unknown docs topic '${name}'.`);
        io.errorLog(`svelte-vitals: known topics: ${knownTopicNames()}.`);
        exitCode = 2;
        return;
      }
      io.log(doc.body);
      exitCode = 0;
    }
  });

  const rootCommand = define({
    name: 'docs',
    // `json` declared but unused here too, for the same family-wide reason as `showCommand` — a
    // bare `docs --json <sub>` reaches this command's own resolution via `fallbackToEntry`.
    args: { json: { type: 'boolean' }, ...HELP_ARG },
    subCommands: { list: listCommand, show: showCommand },
    run: (ctx) => {
      if (ctx.values.help) {
        io.log(DOCS_HELP);
        exitCode = 0;
        return;
      }
      // fallbackToEntry (below) routes here both for a bare `docs` (ctx.omitted) and for an
      // unrecognized first positional. ctx.commandPath is [] at the entry level, so no slicing
      // is needed here (unlike list/show above, which are matched sub-commands).
      const [sub] = [...ctx.positionals, ...tailRest];
      if (sub === undefined) {
        io.errorLog(DOCS_HELP);
        exitCode = 2;
        return;
      }
      io.errorLog(`svelte-vitals: unknown docs subcommand '${sub}'; expected list|show.`);
      io.errorLog(DOCS_HELP);
      exitCode = 2;
    }
  });

  await cli(finalArgv, rootCommand, {
    name: 'svelte-vitals docs',
    subCommands: { list: listCommand, show: showCommand },
    fallbackToEntry: true,
    // Routes every internal gunshi write (version/header/usage/validation-errors all check this
    // before writing) through a no-op — gunshi never touches process.stdout/stderr directly.
    // Nothing here currently produces such a write (no `version` is set, and `--help`/`-h` are
    // this file's own declared args, not gunshi's), but it's the documented seam that keeps that
    // true across a gunshi bump.
    usageSilent: true
  });

  return exitCode;
}
