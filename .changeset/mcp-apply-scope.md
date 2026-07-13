---
'@svelte-vitals/mcp': minor
---

The `analyze` tool now supports `diff`/`baseline` scoping and `svelte-vitals-suppressions.json`, matching the CLI and GitHub Action. Previously the MCP server ignored these entirely, so agents calling `analyze` on a project that scopes its PR gate to changed files or has accepted legacy findings via suppressions would see the full, unscoped backlog resurface.
