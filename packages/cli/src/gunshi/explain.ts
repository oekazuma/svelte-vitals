import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { explainRule, allRules } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
import { EXPLAIN_HELP, renderRuleList, formatRuleExplanation } from '../explain.js';
import { guardArgs } from './guard.js';

/** explain declares no value-carrying flags today — see guard.ts's own doc comment for why the list is still passed explicitly. */
const BOOLEAN_FLAGS = ['json', 'list', 'help'] as const;

/**
 * gunshi/bone port of `explain.ts`'s dispatch (design doc: Phase 2a). Unlike `docs`, this is a
 * flat command with no sub-commands — `explain` is passed as its own `cli()` entry, so
 * `ctx.commandPath` is always `[]` and `ctx.positionals` already IS "args after `explain`" with
 * no path-token splicing to slice off (see the regression test pinning this alongside docs's
 * real slice case). See docs.ts for the exit-code closure pattern this mirrors.
 */
export async function runExplainCliGunshi(args: string[], io: CliIO = consoleIO): Promise<number> {
  const guard = guardArgs(args, [], BOOLEAN_FLAGS);
  for (const e of guard.errors) io.errorLog(e);
  if (guard.errors.length > 0) return 2;

  let exitCode = 0;

  const explainCommand = define({
    name: 'explain',
    args: {
      list: { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      // Left un-required, same reasoning as docs show's `name` (gunshi/docs.ts): a missing rule
      // id is reported with this command's own wording, not gunshi's required-positional error.
      id: { type: 'positional', required: false }
    },
    run: (ctx) => {
      if (ctx.values.help) {
        io.log(EXPLAIN_HELP);
        exitCode = 0;
        return;
      }

      if (ctx.values.list) {
        // Extra positionals reaching here would misrepresent themselves as "explaining that id".
        if (ctx.positionals.slice(ctx.commandPath.length).length > 0) {
          io.errorLog('svelte-vitals: explain --list takes no rule id; drop --list to explain one.');
          exitCode = 2;
          return;
        }
        io.log(
          ctx.values.json
            ? JSON.stringify(
                allRules.map((r) => ({ id: r.id, category: r.category, severity: r.severity, title: r.title })),
                null,
                2
              )
            : renderRuleList()
        );
        exitCode = 0;
        return;
      }

      const id = ctx.values.id;
      if (id === undefined) {
        io.errorLog(
          'svelte-vitals: explain needs a rule id, e.g. `svelte-vitals explain seo/ssr-disabled`; `--list` shows them all.'
        );
        io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
        exitCode = 2;
        return;
      }

      const info = explainRule(id);
      if (!info) {
        io.errorLog(`svelte-vitals: unknown rule id '${id}'.`);
        io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
        exitCode = 2;
        return;
      }

      io.log(ctx.values.json ? JSON.stringify(info, null, 2) : formatRuleExplanation(info));
      exitCode = 0;
    }
  });

  await cli(guard.argv, explainCommand, {
    name: 'svelte-vitals explain',
    // No writes this command can trigger currently rely on this (see docs.ts's identical note),
    // kept for the same forward-compat reason.
    usageSilent: true
  });

  return exitCode;
}
