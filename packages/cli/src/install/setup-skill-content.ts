import { allRules, docsUrlFor, type RuleOptionSpec } from '@svelte-vitals/core/internal';
import { oneLine } from './skill-content.js';

/** An option carrying no signal to check against: an empty list or map. An integer option always
 * has a real numeric default, so it never counts as empty. Mirrors skill-content.ts's rule for
 * the same reason — a rule whose every option is empty examines nothing until configured. */
function isEmptyDefault(spec: RuleOptionSpec): boolean {
  if (spec.kind === 'string-list') return spec.default.length === 0;
  if (spec.kind === 'string-map') return Object.keys(spec.default).length === 0;
  return false;
}

function optionLine(name: string, spec: RuleOptionSpec): string {
  const grammar = spec.kind === 'string-list' && spec.pattern ? ` — each entry is ${spec.pattern.describe}` : '';
  return `  - \`${name}\` (${spec.kind}, default \`${JSON.stringify(spec.default)}\`)${grammar}`;
}

/**
 * Every rule that takes options, with its option names, kinds, defaults and reserved grammars.
 * What an option *means* is deliberately absent: `RuleOptionSpec` has no description field, and
 * the difference between (say) `scopes` and `unitScopes` lives only on the rule's docs page — so
 * each entry ends at that URL and the skill's workflow requires opening it.
 */
export function configurableRulesReference(): string {
  const entries = allRules
    .filter((rule) => rule.options)
    .map((rule) => {
      const specs = Object.entries(rule.options!);
      const inert = specs.length > 0 && specs.every(([, spec]) => isEmptyDefault(spec));
      const mark = inert ? ' — **inert until configured**' : '';
      const options = specs.map(([name, spec]) => optionLine(name, spec)).join('\n');
      return `- **${rule.id}** — ${oneLine(rule.title)}${mark}\n${options}\n  - meaning: ${docsUrlFor(rule.id)}`;
    });
  return entries.join('\n');
}
