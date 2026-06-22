# @svelte-vitals/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [svelte-vitals](https://github.com/oekazuma/svelte-vitals). Lets an AI agent run SvelteKit SEO analysis inside its tool loop and receive structured, fixable findings.

## Tools

- **`analyze`** — run static-mode analysis on a project path; returns per-route and site-wide scores plus findings with `fix`/`recommendation`/`docsUrl`. Inputs: `path?`, `metaComponents?`, `route?`, `treatDynamicAs?`, `rules?`, `ignore?`, `failOn?`.
- **`explain_rule`** — given a rule id (e.g. `SEO001`), returns its title, category, severity, rationale, docs URL, and fix template.

## Usage (stdio)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "svelte-vitals": {
      "command": "npx",
      "args": ["-y", "@svelte-vitals/mcp"]
    }
  }
}
```

ESM-only. Requires Node 18+.
