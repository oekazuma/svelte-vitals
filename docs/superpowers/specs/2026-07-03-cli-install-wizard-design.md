# CLI interactive install wizard (MCP setup)

**Date:** 2026-07-03
**Status:** Approved
**Package:** `@svelte-vitals/cli` (aka `svelte-vitals`)

## Context

Sub-project **B** of making the CLI more interactive and rich. Sub-project A (rich console output) shipped in #82. Today, wiring svelte-vitals into an AI-agent's MCP client is manual: the user hand-edits their client config to add a `svelte-vitals` server pointing at `npx -y @svelte-vitals/mcp` (see `docs/.../guides/mcp.md`). This sub-project automates that with an interactive `svelte-vitals install` wizard.

AI-agent integration is a core product pillar, so a one-command MCP setup directly serves it. This is product-specific convenience (configuring *our* server across clients), not a duplication of any client's general tooling.

## Goal

`npx svelte-vitals install` interactively configures the svelte-vitals MCP server for the user's chosen clients (Claude Code, Cursor, Codex), merging into their existing config **without clobbering** other servers, with flag-driven fallback for non-interactive environments.

## Decisions (settled during brainstorming)

1. **Scope = MCP config only.** No agent-instruction files, no pre-commit hook (both deferred/declined).
2. **Clients = Claude Code, Cursor, Codex** (all three in v1).
3. **Write scope chosen at runtime**, per client (project vs global where both apply).
4. **Interactive prompts via a lightweight library** — `@clack/prompts` (hand-rolling a multi-select TUI was judged too costly vs. a spinner). The CLI already carries a few small deps; adding a prompt + TOML lib is accepted.
5. **Approach = per-client writer modules + clack orchestration.** TOML merge uses `smol-toml` (not hand-rolled) to avoid corrupting Codex's global config.

## Design

### 1. Command surface & flags

New subcommand `svelte-vitals install`. In `bin.ts`, branch on `argv._[0] === 'install'` → route to `runInstall()`. No subcommand → the existing scanner, unchanged (**backward compatible**).

Flags (all enable non-interactive use):

| Flag | Meaning |
| ---- | ------- |
| `--client <ids>` | Comma-separated `claude-code,cursor,codex`. When given, skips the client picker. |
| `--scope <project\|global>` | Applies to all selected clients. Codex is always forced to `global`. |
| `--yes` / `-y` | Skip the confirmation prompt. |
| `--dry-run` | Print the planned changes and exit without writing. |
| `--force` | Overwrite an existing `svelte-vitals` entry without asking. |

The `install` subcommand is parsed with its own `mri` options (separate from the scanner's), so scanner flags and install flags don't collide. Help gains an `install` usage section.

### 2. Client writer modules (`src/install/clients.ts`)

```ts
export interface McpEntry {
  command: string;
  args: string[];
}
export const MCP_ENTRY: McpEntry = { command: 'npx', args: ['-y', '@svelte-vitals/mcp'] };

export type ClientId = 'claude-code' | 'cursor' | 'codex';
export type Scope = 'project' | 'global';

export interface ClientWriter {
  id: ClientId;
  label: string;
  scopes: Scope[]; // codex: ['global'] only
  format: 'json' | 'toml';
  /** Resolve the config file path for a scope. `cwd` = project root, `home` = user home. */
  resolvePath(scope: Scope, cwd: string, home: string): string;
}
```

| Client | project path | global path | format | key |
| ------ | ------------ | ----------- | ------ | --- |
| Claude Code | `.mcp.json` | `~/.claude.json` | json | `mcpServers.svelte-vitals` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` | json | `mcpServers.svelte-vitals` |
| Codex | — | `~/.codex/config.toml` | toml | `mcp_servers.svelte-vitals` |

### 3. Merge / write (`src/install/merge.ts`, pure)

```ts
export type MergeStatus = 'created' | 'added' | 'exists' | 'updated';
export interface MergeResult {
  content: string;
  status: MergeStatus;
}
export function mergeJson(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult;
export function mergeToml(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult;
```

- Read the existing file if present. JSON → `JSON.parse`; TOML → `smol-toml.parse`. **On parse failure, throw** (never clobber a config we can't understand).
- Preserve the whole existing object; ensure the `mcpServers` / `mcp_servers` table exists; set only the `svelte-vitals` key.
- If the `svelte-vitals` key already exists:
  - equal to what we'd write → `exists` (no change),
  - different and `force` → `updated`,
  - different and not `force` → `exists` (skip; caller reports "already configured, use --force").
- Missing file → `created`; existing file, new key → `added`.
- Serialize: JSON with 2-space indent + trailing newline; TOML via `smol-toml.stringify`.

### 4. Wizard flow (`src/install/index.ts`)

`runInstall` takes injected IO + prompt so it is testable without real fs/clack:

```ts
export interface InstallIO {
  readFile(path: string): string | undefined; // undefined if missing
  writeFile(path: string, content: string): void; // mkdir -p dirname internally
  cwd: string;
  home: string;
  isTTY: boolean;
}
export interface InstallPrompts {
  selectClients(all: ClientWriter[], defaults: ClientId[]): Promise<ClientId[] | null>; // null = cancelled
  selectScope(client: ClientWriter): Promise<Scope | null>;
  confirm(planText: string): Promise<boolean>;
}
export interface InstallFlags {
  client?: ClientId[];
  scope?: Scope;
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
}
export function runInstall(flags: InstallFlags, io: InstallIO, prompts: InstallPrompts): Promise<number>;
```

Flow:

1. **Select clients** — `flags.client` if given; else if `io.isTTY` → `prompts.selectClients` (default-checked = clients whose config file already exists via `io.readFile`); else (non-TTY, no flag) → error asking for `--client`, exit 2.
2. **Per-client scope** — for each client with `scopes.length > 1`: `flags.scope` if given; else if TTY → `prompts.selectScope`; else default `project`. Codex → always `global`.
3. **Build plan** — for each (client, scope): resolve path, read existing, compute `MergeResult`. Plan rows: client label, path, action (create/add/update/exists).
4. **Preview & confirm** — render the plan. `--dry-run` → print, exit 0, no writes. Else if not `--yes` and TTY → `prompts.confirm`; cancel → exit 0 (nothing written).
5. **Write** — write each file whose status ≠ `exists`. Report per-client result + next step ("restart <client> to load the MCP server").
6. **Exit codes** — 0 success (incl. dry-run and cancel), 2 on write error / bad flag / non-TTY without `--client`.

`bin.ts` builds the real `InstallIO` (node:fs, `os.homedir()`, `process.stdout.isTTY`) and the real clack-backed `InstallPrompts`, then calls `runInstall`. Cancellation (Ctrl+C / clack cancel symbol) maps to a clean exit 0 with "cancelled".

### 5. Dependencies & file layout

Add to `packages/cli` deps: `@clack/prompts`, `smol-toml`. The repo pins shared versions via the pnpm workspace `catalog:` (see other packages), so add both to the catalog and reference them as `catalog:` in `packages/cli/package.json`.

```
packages/cli/src/install/
  index.ts     // runInstall orchestration + InstallIO/Prompts/Flags
  clients.ts   // ClientWriter defs + MCP_ENTRY
  merge.ts     // mergeJson / mergeToml (pure)
packages/cli/test/install/
  clients.test.ts // resolvePath per scope×client
  merge.test.ts   // json+toml: created/added/exists/updated, preserves existing servers
  index.test.ts   // runInstall with injected IO+prompts: plan, dry-run, non-TTY, force, cancel
```

Plus: `bin.ts` subcommand routing + install flag parsing + help; a changeset (`svelte-vitals` minor).

The clack-backed `InstallPrompts` implementation is a thin adapter; it is exercised by hand, not unit-tested. All decision logic lives in the pure functions and in `runInstall` (tested via injection).

### 6. Testing

- **Pure:** `mergeJson`/`mergeToml` (all four statuses; existing servers preserved; parse-failure throws), `resolvePath` for every scope×client.
- **Orchestration:** `runInstall` with fake IO + fake prompts — flag-only run, dry-run writes nothing, non-TTY without `--client` exits 2, `exists` skipped without `--force` and rewritten with it, cancel writes nothing, multi-client plan.
- Full suite + typecheck + lint + docs build green; no existing assertions loosened.

### 7. Non-goals (YAGNI / deferred)

- Other clients (Windsurf, Zed, etc.) — the writer-module shape makes them easy to add later.
- An `uninstall` command.
- Editing agent-instruction files (scope option B, declined).
- Deep client auto-detection — presence detection only sets the default-checked state in the picker.
- Docs update to `guides/mcp.md` advertising the wizard can follow in the same PR but is not a design concern here.
