---
'svelte-vitals': minor
---

**`@svelte-vitals/mcp` is removed.** The agent story is now two pieces instead of three: the generated
Agent Skill carries the rule knowledge, and the CLI runs the analysis. Nothing that the MCP server could
do is lost — but one thing it could do had no CLI equivalent, so this release adds it first.

**New: `svelte-vitals explain <rule-id>`.** Prints a single rule's title, category, default severity,
rationale, docs URL and fix template — plus, for a configurable rule, every option's default, bounds, and
**how a configured value merges with the built-in default** (`integer` replaces it, `string-list` appends
to it, `string-map` is spread over it, so a built-in key's value is overridden rather than duplicated).
`--json` emits the same object the `explain_rule` tool returned as `structuredContent`. An unknown id
lists every known id and exits `2`.

```bash
npx svelte-vitals explain performance/heavy-import
```

### Why the server is going away

- **`analyze` duplicated the CLI without reaching anywhere new.** Its input schema was a hand-maintained
  mirror of the CLI flags, and its transport was stdio-only — any host that can spawn
  `npx -y @svelte-vitals/mcp` can equally run `npx svelte-vitals`.
- **A remote server would not have changed that.** svelte-vitals analyzes a whole route tree plus config
  and `package.json` on disk, so a hosted version would have to receive the source or clone the repo —
  which is the GitHub Action's job, not an MCP server's.
- **Version skew.** `npx -y @svelte-vitals/mcp` resolved independently of the `svelte-vitals` your project
  pins; running the CLI from the project does not.
- **The skill already knew the rules.** The generated `SKILL.md` embeds the full rule catalog. `explain`
  now covers the only part it didn't.

### Migration

| Was                                           | Now                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `analyze` tool                                | `npx svelte-vitals . --reporter agent` (Markdown for agents) or `--reporter json`      |
| `explain_rule` tool                           | `npx svelte-vitals explain <rule-id>` (`--json` for the same object)                   |
| `install --client claude-code\|cursor\|codex` | `install --client claude-skill` — one skill file read by Claude Code, Codex and Cursor |

`svelte-vitals install` no longer offers the MCP client targets, and `--scope` (which only ever chose
between a project and a global client config) is gone with them. `--scope` is now only warned about and
ignored. Each removed client id is warned about and skipped, so a `--client` list that also names a live
target still installs that target — but a list of **only** removed ids leaves nothing to install and still
exits `2`, so a script pinned to `--client claude-code,cursor,codex` needs updating to `claude-skill`.

**Removing the leftover server entry is manual, by design:** `.mcp.json`, `.cursor/mcp.json` and
`~/.codex/config.toml` are your files, shared with your other servers, so nothing rewrites them on your
behalf. Delete the `svelte-vitals` key under `mcpServers` (or `[mcp_servers.svelte-vitals]` for Codex).

If you generated an Agent Skill from an older release, re-run `npx svelte-vitals@latest install --refresh`
— the old copy still tells your agent to call `explain_rule`.
