---
title: MCP server
description: Let AI agents run svelte-vitals analysis via the Model Context Protocol.
---

`@svelte-vitals/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes svelte-vitals as tools an AI agent can call inside its tool loop. The agent receives structured, actionable findings — each with a `fix`, `recommendation`, and `docsUrl` — without needing to spawn a CLI subprocess manually.

> **ESM-only** (Node 18+). Ships ES modules only; `require()` is unsupported by design.

## Tools

### `analyze`

Run static-mode analysis on a SvelteKit project.

**Inputs:**

| Parameter        | Type                                 | Description                                         |
| ---------------- | ------------------------------------ | --------------------------------------------------- |
| `path`           | `string?`                            | Path to the SvelteKit project (defaults to cwd)     |
| `metaComponents` | `string[]?`                          | Component names that emit head metadata             |
| `route`          | `string?`                            | Only analyze routes matching this glob              |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'?`        | How to handle dynamic metadata values               |
| `rules`          | `string[]?`                          | Rule IDs to enable (all others disabled)            |
| `ignore`         | `string[]?`                          | Rule IDs to disable                                 |
| `failOn`         | `'critical' \| 'warning' \| 'info'?` | Severity threshold for the response's `failed` flag |

**Returns:** per-route and site-wide scores plus a list of findings, each with `fix`, `recommendation`, and `docsUrl`.

### `explain_rule`

Return documentation for a single rule.

**Inputs:**

| Parameter | Type     | Description             |
| --------- | -------- | ----------------------- |
| `ruleId`  | `string` | Rule ID (e.g. `SEO001`) |

**Returns:** the rule's title, category, severity, rationale, docs URL, and fix template.

## Setup

### Claude Desktop / Claude Code

Add to your MCP client configuration (e.g. `~/.claude/claude_desktop_config.json`):

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

### Other MCP clients

Any client that supports stdio-transport MCP servers can use the same pattern — set the command to `npx` and args to `["-y", "@svelte-vitals/mcp"]`.

## Transport

The server communicates over **stdio** — no HTTP port is opened.
