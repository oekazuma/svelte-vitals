# @svelte-vitals/mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for [svelte-vitals](https://github.com/oekazuma/svelte-vitals). Lets an AI agent run static SvelteKit code-health analysis (SEO, performance, correctness, security, architecture) inside its tool loop and receive structured, fixable findings.

## Tools

- **`analyze`** — run static-mode analysis on a project path; returns per-route and site-wide scores plus findings with `fix`/`recommendation`/`docsUrl`. Inputs: `path?`, `metaComponents?`, `route?`, `diff?`, `baseline?`, `noSuppressions?`, `treatDynamicAs?`, `rules?`, `ignore?`, `categories?`, `failOn?`, `weights?`.
- **`explain_rule`** — given a rule id (e.g. `seo/title-presence`), returns its title, category, severity, rationale, docs URL, and fix template.

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

**ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.
