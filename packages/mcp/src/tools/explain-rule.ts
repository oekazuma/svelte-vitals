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
 * semantics without reading the docs site. `integer` replaces the default;
 * `string-list` / `string-map` are added to it.
 */
function describeOptions(id: string, options: RuleOptionInfo[]): string {
  const lines = options.map((o) => {
    const bounds = [o.min !== undefined ? `>= ${o.min}` : '', o.max !== undefined ? `<= ${o.max}` : '']
      .filter(Boolean)
      .join(', ');
    const merge = o.kind === 'integer' ? 'replaces the default' : 'added to the default, never replaces it';
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
