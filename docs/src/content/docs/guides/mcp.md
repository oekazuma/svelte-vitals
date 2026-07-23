---
title: MCP server
description: Let AI agents run svelte-vitals analysis via the Model Context Protocol.
sidebar:
  order: 6
---

`@svelte-vitals/mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes svelte-vitals as tools an AI agent can call inside its tool loop. The agent receives structured, actionable findings — each with a `fix`, `recommendation`, and `docsUrl` — without needing to spawn a CLI subprocess manually.

> **ESM-only** (Node 22.13+). Ships ES modules only; `require()` is unsupported by design.

## Tools

### `analyze`

Run static-mode analysis on a SvelteKit project.

**Inputs:**

| Parameter        | Type                                 | Description                                                                                                                                    |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `path`           | `string?`                            | Path to the SvelteKit project (defaults to cwd)                                                                                                |
| `metaComponents` | `string[]?`                          | Component names that emit head metadata                                                                                                        |
| `route`          | `string?`                            | Only analyze routes matching this glob                                                                                                         |
| `diff`           | `string?`                            | Scope findings to files changed vs this git ref (e.g. `"origin/main"`); mirrors the CLI `--diff` flag                                          |
| `baseline`       | `string?`                            | Report only findings not already present at this git ref (e.g. `"origin/main"`); mirrors the CLI `--baseline` flag                             |
| `noSuppressions` | `boolean?`                           | Ignore `svelte-vitals-suppressions.json` for this call; mirrors the CLI `--no-suppressions` flag                                               |
| `treatDynamicAs` | `'pass' \| 'warn' \| 'fail'?`        | How to handle dynamic metadata values                                                                                                          |
| `rules`          | `string[]?`                          | Rule IDs to enable (all others disabled)                                                                                                       |
| `ignore`         | `string[]?`                          | Rule IDs to disable                                                                                                                            |
| `categories`     | `string[]?`                          | Restrict analysis to these categories (intersection with `rules`/`ignore`; case-insensitive)                                                   |
| `failOn`         | `'critical' \| 'warning' \| 'info'?` | Severity threshold for the response's `failed` flag                                                                                            |
| `weights`        | `Record<string, number>?`            | Per-category weights for the combined Health score, e.g. `{"seo": 2}` (category keys are case-insensitive; unlisted categories default to `1`) |

**Returns:** per-route and site-wide scores plus a list of findings, each with `fix`, `recommendation`, and `docsUrl`.

A project-level `svelte-vitals.config` file (see [Config file](/guides/configuration)) is also read automatically — these tool arguments override it the same way CLI flags do.

### `explain_rule`

Return documentation for a single rule.

**Inputs:**

| Parameter | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| `ruleId`  | `string` | Rule ID (e.g. `seo/title-presence`) |

**Returns:** the rule's title, category, severity, rationale, docs URL, and fix template.

## Setup

### Quick setup (recommended)

Run the interactive installer from your project root — it configures the MCP server for you:

```bash
npx svelte-vitals@latest install
```

It supports **Claude Code**, **Cursor**, and **Codex**, merging the server entry into each client's config without touching your other servers. See [`svelte-vitals install`](/guides/install) for the available flags (`--client`, `--scope`, `--yes`, `--dry-run`, `--force`).

### Manual setup

Any MCP client that supports stdio-transport servers can be configured by hand. Add the following to the client's config (e.g. Claude Code's `.mcp.json`, or `~/.claude.json`):

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

For Codex, the equivalent TOML in `~/.codex/config.toml`:

```toml
[mcp_servers.svelte-vitals]
command = "npx"
args = ["-y", "@svelte-vitals/mcp"]
```

## Transport

The server communicates over **stdio** — no HTTP port is opened.
