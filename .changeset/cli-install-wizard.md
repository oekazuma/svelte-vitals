---
'svelte-vitals': minor
---

Add an interactive `svelte-vitals install` command that sets up the svelte-vitals
MCP server for Claude Code, Cursor, and Codex. It merges into your existing client
config without touching other servers, prompts for the clients and scope
(project/global) interactively, and supports `--client`, `--scope`, `--yes`,
`--dry-run`, and `--force` for non-interactive use.
