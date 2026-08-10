import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { docsUrlFor } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
import { EMBEDDED_DOCS } from '../docs/generated.js';
import { DOCS_HELP, knownTopicNames, renderList } from '../docs/cli.js';
import { guardArgs } from './guard.js';

/** docs declares no value-carrying flags today — see guard.ts's own doc comment for why the list is still passed explicitly. */
const BOOLEAN_FLAGS = ['json', 'help'] as const;
const HELP_ARG = { help: { type: 'boolean', short: 'h' } } as const;

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
  const guard = guardArgs(args, [], BOOLEAN_FLAGS);
  for (const e of guard.errors) io.errorLog(e);
  if (guard.errors.length > 0) return 2;

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
      // recovers "args after the sub-command name".
      const extra = ctx.positionals.slice(ctx.commandPath.length);
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
      ...HELP_ARG
    },
    run: (ctx) => {
      if (ctx.values.help) {
        io.log(DOCS_HELP);
        exitCode = 0;
        return;
      }
      // `docs show a b` printing only `a` would misrepresent itself as "here are both".
      const rest = ctx.positionals.slice(ctx.commandPath.length);
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
    args: HELP_ARG,
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
      const [sub] = ctx.positionals;
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

  await cli(guard.argv, rootCommand, {
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
