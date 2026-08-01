# Design: Remove the MCP server, standardize on CLI + Agent Skills

`@svelte-vitals/mcp` (designed in `2026-06-22-mcp-server-design.md`, shipped since 0.x) is removed. The
agent story becomes exactly two pieces: **the generated Agent Skill carries the rule knowledge, and the
CLI executes**. This is a breaking removal of a published package, so the reasoning is recorded here and
restated for users in the changeset.

## Why remove it

The server exposed two tools, `analyze` and `explain_rule`, over ~255 lines of source.

1. **`analyze` duplicates the CLI with no reach gained.** Its zod schema is a hand-written mirror of the
   CLI flags — `analyze.ts` itself annotates five inputs with "Mirrors the CLI `--x` flag". Every new flag
   costs a second edit, and the two surfaces can silently drift.
2. **The transport is stdio-only** (`StdioServerTransport`, no HTTP/Streamable HTTP). Any host that can
   spawn `npx -y @svelte-vitals/mcp` can equally run `npx svelte-vitals`. There is no environment the
   server reaches that the CLI does not.
3. **A remote server would not fix that, and is not a small change.** svelte-vitals statically analyzes a
   whole route tree plus config and `package.json`, so a remote deployment would have to either receive the
   source tree or clone the repo itself. The second is a hosted scan service — the niche
   [svelte-vitals-action](https://github.com/oekazuma/svelte-vitals-action) already fills for CI. The MCP
   server also imports `analyzeProject`/`applyScope` from the `svelte-vitals` CLI package, which run git and
   read config from disk; making it remote is a rewrite, not a transport swap.
4. **Version skew.** Clients register the server as `npx -y @svelte-vitals/mcp`, which resolves independently
   of the project's own pinned `svelte-vitals`. `npx svelte-vitals` in a project resolves the local one.
5. **The Skill already carries the knowledge.** `skill-content.ts`'s `ruleDigest()` embeds every rule's id,
   title, severity, rationale, fix and docs link into the generated `SKILL.md`. `explain_rule` added only one
   thing on top: the configurable **options** and their merge semantics.

## Decision

Remove the package. Before removing it, move the one non-duplicated capability into the CLI:

```
svelte-vitals explain <rule-id> [--json]
```

It prints exactly what `explain_rule` returned — title, category, default severity, rationale, docs URL, fix
template, and the configurable options with their per-kind merge semantics (`integer` replaces,
`string-list` appends, `string-map` is spread over the defaults). `--json` emits the same `RuleInfo` object
the tool returned as `structuredContent`, so an agent that wants structure still has it. An unknown id lists
the known ids and exits 2, matching the tool's `isError` result and the CLI's existing exit-code contract.

## Scope — what to remove

**Package:**

- **Delete** `packages/mcp/` in full (src, tests, README, CHANGELOG, tsup/tsconfig).
- Root `package.json`: drop `@svelte-vitals/mcp` from the `check:publint` and `check:types` filter lists.

**`svelte-vitals install` — the "MCP server" section goes with it.** Writing a client config that launches a
deleted package is worse than writing nothing, so the whole client-target concept is removed:

- **Delete** `packages/cli/src/install/clients.ts` (`CLIENTS`, `MCP_ENTRY`, `ClientWriter`, `Scope`) and
  `merge.ts` (the `mcpServers` / `mcp_servers` JSON+TOML mergers), plus `test/install/clients.test.ts` and
  `test/install/merge.test.ts`.
- `install/index.ts`: `TargetId` loses `ClientId`; `planForClient`, the client detection probe, the
  `'MCP server'` picker group, the per-client scope resolution loop, `PlanRow.scope`, `InstallPrompts.selectScope`,
  `InstallFlags.scope` and the closing "Restart your client…" line all go.
- `install/args.ts` + `install/cli.ts`: drop `--scope` and the `claude-code,cursor,codex` ids from parsing,
  help text and the non-TTY guidance.
- `install/cli.ts`: `clackPrompts().selectScope` goes; the `@clack/prompts` scope select is unused after this.
- Cursor detection for the `cursor-rules` agent target probed `.cursor/mcp.json`, which stops being a Cursor
  signal here. It moves to the `.cursor/rules/svelte-vitals.mdc` the target itself writes — "already
  installed pre-checks the box", the same rule the CI and config-file probes already follow. It has to stay a
  _file_ probe: `InstallIO.readFile` maps only ENOENT to undefined and rethrows EISDIR, so probing the
  `.cursor/` directory would read as "not present".

**Docs (en + ja, kept in sync per AGENTS.md):**

- **Delete** `guides/(ai-agents)/mcp.md` in both trees.
- Update `choosing-a-package`, `getting-started`, `(setup)/install`, `(setup)/cli`, `(setup)/configuration`,
  `(reporting)/ci` to drop the MCP package/rows and point at `explain` + the Skill instead.
- `README.md`, `packages/cli/README.md`, `AGENTS.md` (package map), `CONTRIBUTING.md`.

**Generated agent files:** `skill-content.ts` and `improve-skill-content.ts` tell agents to reach for the
`explain_rule` MCP tool; both are repointed at `svelte-vitals explain <rule-id>`. A user who generated a
skill from an older version gets the new text by re-running `svelte-vitals install --refresh`.

**Stale comments** referencing the MCP consumer: `packages/core/src/rules/index.ts` (`explainRule`),
`packages/core/src/reporter/json.ts` (`buildJsonReport`), `packages/cli/src/index.ts`, `packages/cli/src/config-file.ts`.

## What stays unchanged (verify)

- `explainRule()` and `buildJsonReport()` themselves — they were always core functions the tool merely
  called, and the CLI's `explain` / `--reporter json` keep them exported and covered.
- `--reporter agent`, `--reporter json`: the agent-facing output paths are untouched, and remain how an agent
  gets findings. `--reporter agent` is what the generated Skill's playbook already tells agents to run.
- The `claude-skill`, `claude-skill-improve` and `cursor-rules` install targets, including their three-location
  write (`.claude/skills/`, `.agents/skills/`, `.cursor/skills/`) from plan 042.
- `svelte-vitals ci install` / `ci upgrade` and the `config-file` target — unrelated sections of the same wizard.

## Migration for users

| Was                                           | Now                                                                                          |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `analyze` MCP tool                            | `npx svelte-vitals . --reporter agent` (or `--reporter json`)                                |
| `explain_rule` MCP tool                       | `npx svelte-vitals explain <rule-id>` (`--json` for the same object)                         |
| `install --client claude-code\|cursor\|codex` | `install --client claude-skill` (writes the Skill for Claude Code, Codex and Cursor at once) |

Removing the server entry from `.mcp.json` / `.cursor/mcp.json` / `~/.codex/config.toml` is left to the user:
the installer writes into shared, user-owned config files that it does not exclusively own, so uninstalling
by rewriting them is out of scope. The changeset says so explicitly and names the key (`svelte-vitals`).

## Testing

- New `packages/cli/test/explain.test.ts`: a known id renders every section; a rule with options renders the
  three merge-semantics phrasings; `--json` round-trips `explainRule()`; an unknown id exits 2 and lists ids;
  a missing id exits 2.
- `test/install/run.test.ts`, `args.test.ts`, `cli.test.ts`: client/scope cases removed, remaining targets
  unaffected. `skill-content.test.ts` / `improve-skill-content.test.ts` assert the new `explain` reference and
  that no `explain_rule` / MCP mention survives.
- Full gate: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm check:publish`, and the docs build.

## Non-goals / follow-ups

- No deprecation shim or stub package that forwards to the CLI — a stdio server has no useful degraded mode.
  The npm dist-tag deprecation message is the migration pointer.
- No `svelte-vitals explain --list`: the unknown-id error already prints every known id, and the generated
  Skill carries the full digest.
- If a hosted/remote analysis surface is ever wanted, it starts from the Action's model (server clones the
  repo), not from resurrecting this package.
