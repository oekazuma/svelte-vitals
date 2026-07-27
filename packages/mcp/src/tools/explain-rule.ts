import { z } from 'zod';
import { explainRule, type RuleOptionInfo } from '@svelte-vitals/core';
import { knownRuleIds } from 'svelte-vitals';
import type { McpToolResult } from './analyze.js';

const explainRuleInputSchema = z.object({
  id: z.string().describe('Rule id to explain, e.g. "seo/title-presence".')
});

export const explainRuleInputShape = explainRuleInputSchema.shape;
export type ExplainRuleArgs = z.infer<typeof explainRuleInputSchema>;

/**
 * One line per configurable option, so an agent that reads a finding as a
 * threshold disagreement rather than a defect can name the knob and its merge
 * semantics without reading the docs site.
 *
 * The three kinds merge differently and the wording has to say so exactly: an
 * `integer` replaces the default outright; a `string-list` appends to it; a
 * `string-map` is spread over it, so new keys are added but a key that already
 * exists built-in has its value overridden. That last case is what lets a project
 * reword the built-in advice for a package rather than only extend the list.
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
    const merge = MERGE[o.kind];
    return `- ${o.name} (${o.kind}, default ${JSON.stringify(o.default)}${bounds ? `, ${bounds}` : ''}) — ${merge}`;
  });
  return (
    `set in svelte-vitals.config.* as \`rules: { '${id}': { options: { … } } }\`, ` +
    `or per path in \`overrides\`:\n${lines.join('\n')}`
  );
}

/**
 * Handle the `explain_rule` tool call: look up a rule's static metadata and
 * return it as both a text rendering and `structuredContent`. An unknown id is
 * returned as an `isError` result listing the known rule ids.
 */
export async function handleExplainRule(args: ExplainRuleArgs): Promise<McpToolResult> {
  const info = explainRule(args.id);
  if (!info) {
    return {
      content: [{ type: 'text', text: `Unknown rule id: ${args.id}. Known rule ids: ${knownRuleIds().join(', ')}.` }],
      isError: true
    };
  }
  const text =
    `${info.id} — ${info.title} (${info.severity}, ${info.category})\n\n` +
    `${info.rationale}\n\nDocs: ${info.docsUrl}` +
    (info.fix ? `\n\nFix: ${info.fix.description}` : '') +
    (info.options ? `\n\nConfigurable: ${describeOptions(info.id, info.options)}` : '');
  return { content: [{ type: 'text', text }], structuredContent: info };
}
