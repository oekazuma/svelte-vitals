import { z } from 'zod';
import { explainRule } from '@svelte-vitals/core';
import { knownRuleIds } from 'svelte-vitals';
import type { McpToolResult } from './analyze.js';

const explainRuleInputSchema = z.object({
  id: z.string().describe('Rule id to explain, e.g. "SEO001".')
});

export const explainRuleInputShape = explainRuleInputSchema.shape;
export type ExplainRuleArgs = z.infer<typeof explainRuleInputSchema>;

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
    (info.fix ? `\n\nFix: ${info.fix.description}` : '');
  return { content: [{ type: 'text', text }], structuredContent: info };
}
