import { allRules, CATEGORIES, explainRule, type RuleOptionInfo } from '@svelte-vitals/core';

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

/** Render a rule's static metadata as the text `svelte-vitals explain` prints. Exported: shared with the gunshi/bone port. */
export function formatRuleExplanation(info: NonNullable<ReturnType<typeof explainRule>>): string {
  return (
    `${info.id} — ${info.title} (${info.severity}, ${info.category})\n\n` +
    `${info.rationale}\n\nDocs: ${info.docsUrl}` +
    (info.fix ? `\n\nFix: ${info.fix.description}` : '') +
    (info.options ? `\n\nConfigurable: ${describeOptions(info.id, info.options)}` : '')
  );
}

/** Every rule, grouped by category — the entry point into `explain`. Exported: shared with the gunshi/bone port. */
export function renderRuleList(): string {
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
