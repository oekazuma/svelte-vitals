import { parseCliArgs } from './cli-args.js';
import { allRules, CATEGORIES, explainRule, type RuleOptionInfo } from '@svelte-vitals/core';
import { consoleIO, type CliIO } from './cli-io.js';
import { knownRuleIds } from './rules-config.js';

const EXPLAIN_HELP = `svelte-vitals explain — print a rule's rationale, fix, and configurable options

Usage:
  svelte-vitals explain --list          List every rule id, grouped by category
  svelte-vitals explain <rule-id>       Explain one rule

Options:
  --list        List every rule instead of explaining one
  --json        Machine-readable output (works with --list and with a rule id)
  -h, --help    Show this help

Rule ids are category/kebab-case and matched exactly, e.g. \`svelte-vitals explain seo/ssr-disabled\`.`;

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

/** Every rule, grouped by category — the entry point into `explain`. */
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

/**
 * Run `svelte-vitals explain <rule-id>`. Returns the exit code: 0 on a hit, 2 for a
 * missing or unknown id (the CLI's "execution error" code — nothing was explained).
 */
export function runExplainCli(args: string[], io: CliIO = consoleIO): number {
  const argv = parseCliArgs(args, { boolean: ['json', 'list', 'help'], short: { h: 'help' } });
  if (argv.help) {
    io.log(EXPLAIN_HELP);
    return 0;
  }

  if (argv.list) {
    if (argv._.length > 0) {
      // Returning the whole list would read as "here is that rule".
      io.errorLog('svelte-vitals: explain --list takes no rule id; drop --list to explain one.');
      return 2;
    }
    io.log(
      argv.json
        ? JSON.stringify(
            allRules.map((r) => ({ id: r.id, category: r.category, severity: r.severity, title: r.title })),
            null,
            2
          )
        : renderRuleList()
    );
    return 0;
  }

  const id = argv._[0];
  if (id === undefined) {
    io.errorLog(
      'svelte-vitals: explain needs a rule id, e.g. `svelte-vitals explain seo/ssr-disabled`; `--list` shows them all.'
    );
    io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
    return 2;
  }

  const info = explainRule(id);
  if (!info) {
    io.errorLog(`svelte-vitals: unknown rule id '${id}'.`);
    io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
    return 2;
  }

  io.log(argv.json ? JSON.stringify(info, null, 2) : formatRuleExplanation(info));
  return 0;
}
