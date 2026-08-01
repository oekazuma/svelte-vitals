import mri from 'mri';
import { explainRule, type RuleOptionInfo } from '@svelte-vitals/core';
import { knownRuleIds } from './rules-config.js';

const EXPLAIN_HELP = `svelte-vitals explain — print a rule's rationale, fix, and configurable options

Usage:
  svelte-vitals explain <rule-id>

Options:
  --json        Print the rule metadata as JSON instead of text
  -h, --help    Show this help

Rule ids are category/kebab-case and matched exactly, e.g. \`svelte-vitals explain seo/ssr-disabled\`.`;

/** The output sink. Narrower than the install wizard's `InstallIO` — explain never touches the filesystem. */
export interface ExplainIO {
  log(line: string): void;
  errorLog(line: string): void;
}

const realIO: ExplainIO = {
  log: (line) => console.log(line),
  errorLog: (line) => console.error(line)
};

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
export function formatRuleExplanation(info: NonNullable<ReturnType<typeof explainRule>>): string {
  return (
    `${info.id} — ${info.title} (${info.severity}, ${info.category})\n\n` +
    `${info.rationale}\n\nDocs: ${info.docsUrl}` +
    (info.fix ? `\n\nFix: ${info.fix.description}` : '') +
    (info.options ? `\n\nConfigurable: ${describeOptions(info.id, info.options)}` : '')
  );
}

/**
 * Run `svelte-vitals explain <rule-id>`. Returns the exit code: 0 on a hit, 2 for a
 * missing or unknown id (the CLI's "execution error" code — nothing was explained).
 */
export function runExplainCli(args: string[], io: ExplainIO = realIO): number {
  const argv = mri(args, { boolean: ['json', 'help'], alias: { h: 'help' } });
  if (argv.help) {
    io.log(EXPLAIN_HELP);
    return 0;
  }

  const id = argv._[0];
  if (id === undefined) {
    io.errorLog('svelte-vitals: explain needs a rule id, e.g. `svelte-vitals explain seo/ssr-disabled`.');
    io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
    return 2;
  }

  const info = explainRule(String(id));
  if (!info) {
    io.errorLog(`svelte-vitals: unknown rule id '${id}'.`);
    io.errorLog(`svelte-vitals: known rule ids: ${knownRuleIds().join(', ')}.`);
    return 2;
  }

  io.log(argv.json ? JSON.stringify(info, null, 2) : formatRuleExplanation(info));
  return 0;
}
