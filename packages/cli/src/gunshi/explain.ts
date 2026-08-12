import { cli } from 'gunshi/bone';
import { define } from 'gunshi/definition';
import { generate } from 'gunshi/generator';
import { explainRule, allRules, CATEGORIES, type RuleOptionInfo } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from '../cli-io.js';
import { knownRuleIds } from '../rules-config.js';
import { guardArgs, splitAtTerminator, stripUnknownFlags, stripAutoVersionLine, suggestClosest } from './guard.js';
import { localizedOptionsSection, type Locale } from './locale.js';

/**
 * One line per configurable option, so a reader who takes a finding as a threshold
 * disagreement rather than a defect can name the knob and its merge semantics without
 * opening the docs site.
 *
 * The three kinds merge differently and the wording has to say so exactly: an `integer`
 * replaces the default outright; a `string-list` appends to it; a `string-map` is spread
 * over it, so new keys are added but a key that already exists built-in has its value
 * overridden. That last case is what lets a project reword the built-in advice for a
 * package rather than only extend the list.
 */
function describeOptions(id: string, options: RuleOptionInfo[]): string {
  const MERGE = {
    integer: 'replaces the default',
    'string-list': 'added to the default entries, never replaces them',
    'string-map': 'merged over the default entries — a new key is added, a built-in key has its value overridden'
  } as const;
  const lines = options.map((o) => {
    const bounds = [o.min !== undefined ? `>= ${o.min}` : '', o.max !== undefined ? `<= ${o.max}` : '']
      .filter(Boolean)
      .join(', ');
    return `- ${o.name} (${o.kind}, default ${JSON.stringify(o.default)}${bounds ? `, ${bounds}` : ''}) — ${MERGE[o.kind]}`;
  });
  return (
    `set in svelte-vitals.config.* as \`rules: { '${id}': { options: { … } } }\`, ` +
    `or per path in \`overrides\`:\n${lines.join('\n')}`
  );
}

/** Render a rule's static metadata as the text `svelte-vitals explain` prints. */
function formatRuleExplanation(info: NonNullable<ReturnType<typeof explainRule>>): string {
  return (
    `${info.id} — ${info.title} (${info.severity}, ${info.category})\n\n` +
    `${info.rationale}\n\nDocs: ${info.docsUrl}` +
    (info.fix ? `\n\nFix: ${info.fix.description}` : '') +
    (info.options ? `\n\nConfigurable: ${describeOptions(info.id, info.options)}` : '')
  );
}

/** Every rule, grouped by category — the entry point into `explain --list`. */
function renderRuleList(): string {
  const sections = CATEGORIES.map((category) => {
    const rules = allRules.filter((r) => r.category === category);
    const width = Math.max(...rules.map((r) => r.id.length));
    const lines = rules.map((r) => `  ${r.id.padEnd(width)}  ${r.severity.padEnd(8)} ${r.title}`);
    return [`${category} (${rules.length})`, ...lines].join('\n');
  });
  return [...sections, '', `${allRules.length} rules. Explain one with \`svelte-vitals explain <rule-id>\`.`].join(
    '\n\n'
  );
}

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
 * this is the sole source of `explain --help`'s output. ja-localized when `locale` is 'ja'
 * (`docs/superpowers/specs/2026-08-11-cli-ja-help-design.md`).
 */
async function buildExplainHelpText(explainCommand: Parameters<typeof generate>[1], locale: Locale): Promise<string> {
  // `./locales/ja.js` is imported dynamically, only on the `ja` branch — an English
  // invocation of this (already lazily-dispatched) surface never parses the ja strings.
  const ja = locale === 'ja' ? await import('./locales/ja.js') : undefined;
  const optionsSection = stripAutoVersionLine(
    await localizedOptionsSection(
      explainCommand,
      'svelte-vitals explain',
      locale,
      ja?.JA_ARG_DESCRIPTIONS.explain ?? {}
    )
  );

  if (locale === 'ja') return ja!.explainHelpJa(optionsSection);

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
export async function runExplainCliGunshi(
  args: string[],
  io: CliIO = consoleIO,
  locale: Locale = 'en'
): Promise<number> {
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
        io.log(await buildExplainHelpText(explainCommand, locale));
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
