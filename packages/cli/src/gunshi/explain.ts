import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import { explainRule, allRules } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
import { renderRuleList, formatRuleExplanation } from '../explain.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, stripAutoVersionLine, suggestClosest } from './guard.js';

/** explain declares no value-carrying flags today — see guard.ts's own doc comment for why the list is still passed explicitly. */
const BOOLEAN_FLAGS = ['json', 'list', 'help'] as const;
const KNOWN_LONG_FLAGS = new Set(BOOLEAN_FLAGS);
const KNOWN_SHORT_FLAGS = new Set(['h']);

/** Exported for gunshi/complete.ts — the completion tree's `explain` args mirror this, never a second copy. */
export const EXPLAIN_ARGS = {
  list: { type: 'boolean', description: 'List every rule instead of explaining one' },
  json: { type: 'boolean', description: 'Machine-readable output (works with --list and with a rule id)' },
  help: { type: 'boolean', short: 'h', description: 'Show this help' }
} as const;

/**
 * Hybrid `explain --help` text — same technique as `gunshi/docs.ts`'s `buildDocsHelpText`: hand-
 * written header/usage/footer, OPTIONS generated from this command's own `args`, the auto-injected
 * `-v, --version` line stripped (see `stripAutoVersionLine`). `explain` has no error-path use of
 * its own help text (unlike `docs`/`ci`), so there is no separate frozen constant to keep in sync —
 * this is the sole source of `explain --help`'s output.
 */
async function buildExplainHelpText(explainCommand: Parameters<typeof generate>[1]): Promise<string> {
  const generated = await generate(null, explainCommand, { name: 'svelte-vitals explain', renderHeader: null });
  const optionsIndex = generated.indexOf('OPTIONS:');
  const optionsSection = stripAutoVersionLine(
    optionsIndex === -1 ? generated.trimEnd() : generated.slice(optionsIndex).trimEnd()
  );

  return `svelte-vitals explain — print a rule's rationale, fix, and configurable options

Usage:
  svelte-vitals explain --list          List every rule id, grouped by category
  svelte-vitals explain <rule-id>       Explain one rule

${optionsSection}

Rule ids are category/kebab-case and matched exactly, e.g. \`svelte-vitals explain seo/ssr-disabled\`.`;
}

/**
 * gunshi/bone port of `explain.ts`'s dispatch (design doc: Phase 2a). Unlike `docs`, this is a
 * flat command with no sub-commands — `explain` is passed as its own `cli()` entry, so
 * `ctx.commandPath` is always `[]` and `ctx.positionals` already IS "args after `explain`" with
 * no path-token splicing to slice off (see the regression test pinning this alongside docs's
 * real slice case). See docs.ts for the exit-code closure pattern this mirrors.
 */
export async function runExplainCliGunshi(args: string[], io: CliIO = consoleIO): Promise<number> {
  // `--` must be split off before guard/strip run — see guard.ts's `splitAtTerminator` doc
  // comment. `tail` is appended verbatim to the positional read below.
  const { head, tail } = splitAtTerminator(args);
  // `errors` is only ever populated by a value-carrying flag (guard.ts's own doc comment) —
  // `explain` declares none, so only `.argv` (the `--flag=false` normalization) is used here.
  const argvForGunshi = stripUnknownFlags(guardArgs(head, [], BOOLEAN_FLAGS).argv, KNOWN_LONG_FLAGS, KNOWN_SHORT_FLAGS);

  let exitCode = 0;

  const explainCommand = define({
    name: 'explain',
    // No declared `id` positional: `ctx.positionals` is populated regardless of whether any arg
    // declares `type: 'positional'` (docs.ts's own root command relies on the same fact), and a
    // declared one wouldn't see `tail` (post-`--`) anyway — the rule id is read from the merged
    // `positionals` below instead.
    args: EXPLAIN_ARGS,
    run: async (ctx) => {
      // `tail` (post-`--`) never went through gunshi at all, so it's appended here rather than
      // being part of `ctx.positionals`.
      const positionals = [...ctx.positionals, ...tail];
      if (ctx.values.help) {
        io.log(await buildExplainHelpText(explainCommand));
        exitCode = 0;
        return;
      }

      if (ctx.values.list) {
        // Extra positionals reaching here would misrepresent themselves as "explaining that id".
        if (positionals.length > 0) {
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

      const id = positionals[0];
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
        const hint = suggestClosest(id, knownRuleIds());
        if (hint) io.errorLog(`svelte-vitals: did you mean \`svelte-vitals explain ${hint}\`?`);
        io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
        exitCode = 2;
        return;
      }

      io.log(ctx.values.json ? JSON.stringify(info, null, 2) : formatRuleExplanation(info));
      exitCode = 0;
    }
  });

  await cli(argvForGunshi, explainCommand, {
    name: 'svelte-vitals explain',
    // No writes this command can trigger currently rely on this (see docs.ts's identical note),
    // kept for the same forward-compat reason.
    usageSilent: true
  });

  return exitCode;
}
