import { z } from 'zod';
import { analyzeProject, buildRulesConfig, findUnknownRuleIds, knownRuleIds, ProjectError } from 'svelte-vitals';
import { buildJsonReport } from '@svelte-vitals/core';

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

function textError(message: string): McpToolResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const analyzeInputSchema = z.object({
  path: z.string().optional().describe('Project root to analyze (defaults to the server cwd).'),
  metaComponents: z
    .array(z.string())
    .optional()
    .describe(
      'Component names that resolve SEO tags into <head> (e.g. ["Seo"]); their presence suppresses missing-tag findings for the head they own. Mirrors the CLI --meta-components flag.'
    ),
  route: z.string().optional().describe('Glob to restrict which routes are analyzed, e.g. "blog/**".'),
  treatDynamicAs: z
    .enum(['pass', 'warn', 'fail'])
    .optional()
    .describe('How dynamic ({data.title}) values are scored. Default: pass.'),
  rules: z.array(z.string()).optional().describe('Enable only these rule ids (all others disabled).'),
  ignore: z.array(z.string()).optional().describe('Disable these rule ids.'),
  failOn: z
    .enum(['critical', 'warning', 'info'])
    .optional()
    .describe('Minimum severity that counts as a failure in the summary. Default: critical.')
});

/** zod raw shape for the analyze tool's input (registered with the MCP server). */
export const analyzeInputShape = analyzeInputSchema.shape;
export type AnalyzeArgs = z.infer<typeof analyzeInputSchema>;

/**
 * Handle the `analyze` tool call: run static-mode analysis and return the
 * structured JSON report as both text and `structuredContent`. Unknown rule ids
 * and non-SvelteKit paths are returned as `isError` results, not thrown.
 */
export async function handleAnalyze(args: AnalyzeArgs): Promise<McpToolResult> {
  // Rule ids are accepted case-insensitively; normalize to the canonical
  // uppercase form before validation and config building.
  const allow = (args.rules ?? []).map((id) => id.toUpperCase());
  const ignore = (args.ignore ?? []).map((id) => id.toUpperCase());
  const unknown = findUnknownRuleIds([...allow, ...ignore]);
  if (unknown.length > 0) {
    return textError(`Unknown rule id(s): ${unknown.join(', ')}. Known rule ids: ${knownRuleIds().join(', ')}.`);
  }

  try {
    const { results, config, version } = await analyzeProject({
      cwd: args.path,
      metaComponents: args.metaComponents,
      treatDynamicAs: args.treatDynamicAs,
      route: args.route,
      failOn: args.failOn,
      rules: buildRulesConfig(allow, ignore)
    });
    const report = buildJsonReport(results, config, { version });
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
      structuredContent: report
    };
  } catch (err) {
    if (err instanceof ProjectError) return textError(err.message);
    return textError(`svelte-vitals: ${err instanceof Error ? err.message : String(err)}`);
  }
}
