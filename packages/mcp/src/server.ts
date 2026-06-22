import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { analyzeInputShape, handleAnalyze } from './tools/analyze.js';
import { explainRuleInputShape, handleExplainRule } from './tools/explain-rule.js';

/** Build the svelte-vitals MCP server with all tools registered. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'svelte-vitals', version: '0.0.0' });

  server.registerTool(
    'analyze',
    {
      title: 'Analyze SvelteKit SEO',
      description:
        'Run svelte-vitals static-mode SEO analysis on a SvelteKit project and return a structured report (per-route and site-wide scores, findings with fix/recommendation/docs).',
      inputSchema: analyzeInputShape
    },
    async (args) => (await handleAnalyze(args)) as CallToolResult
  );

  server.registerTool(
    'explain_rule',
    {
      title: 'Explain an SEO rule',
      description: "Return a rule's title, category, default severity, rationale, docs URL, and fix template.",
      inputSchema: explainRuleInputShape
    },
    async (args) => (await handleExplainRule(args)) as CallToolResult
  );

  return server;
}
