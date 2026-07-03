# CLI Interactive Install Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive `svelte-vitals install` subcommand that wires the svelte-vitals MCP server into Claude Code / Cursor / Codex configs without clobbering existing servers, with flag-driven fallback for non-interactive environments.

**Architecture:** A new `src/install/` module in `packages/cli`. Per-client "writer" definitions (path + format) and pure JSON/TOML merge helpers do the real work and are unit-tested. `runInstall(flags, io, prompts)` orchestrates via injected IO + prompt interfaces so it is testable without real fs or clack. `bin.ts` routes the `install` subcommand to a thin adapter that supplies the real node:fs IO and a `@clack/prompts`-backed prompt implementation.

**Tech Stack:** TypeScript (ESM-only), `mri` (arg parsing), `@clack/prompts` (interactive prompts), `smol-toml` (TOML parse/stringify), `vitest`.

## Global Constraints

- **ESM-only** — tsup emits `format: ['esm']` only; never add `'cjs'` (issue #20).
- **Node 18+** (`engines.node >= 18`).
- **New deps go through the pnpm workspace catalog** — add the version range to `catalog:` in `pnpm-workspace.yaml`, then reference `"catalog:"` in `packages/cli/package.json`. (`minimumReleaseAge` is enforced; both libs are long-published.)
- **No competitor product names** in any artifact (code, comments, docs, changeset, commit messages).
- **Release via changeset** — this feature ships a `svelte-vitals` **minor** bump. Never publish manually.
- **Do not loosen any existing test.** Follow TDD; commit after each green step.
- The MCP entry written for every client is exactly `{ command: 'npx', args: ['-y', '@svelte-vitals/mcp'] }`.

---

### Task 1: Client writer modules

**Files:**

- Create: `packages/cli/src/install/clients.ts`
- Test: `packages/cli/test/install/clients.test.ts`

**Interfaces:**

- Consumes: nothing (leaf module).
- Produces: `McpEntry`, `MCP_ENTRY`, `ClientId` (`'claude-code' | 'cursor' | 'codex'`), `Scope` (`'project' | 'global'`), `ClientWriter`, `CLIENTS: ClientWriter[]`, `clientById(id: ClientId): ClientWriter | undefined`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/test/install/clients.test.ts
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { CLIENTS, clientById, MCP_ENTRY } from '../../src/install/clients.js';

const cwd = '/proj';
const home = '/home/u';

describe('client writers', () => {
  it('exposes the fixed MCP entry', () => {
    expect(MCP_ENTRY).toEqual({ command: 'npx', args: ['-y', '@svelte-vitals/mcp'] });
  });
  it('claude-code: project → .mcp.json, global → ~/.claude.json', () => {
    const c = clientById('claude-code')!;
    expect(c.format).toBe('json');
    expect(c.resolvePath('project', cwd, home)).toBe(join('/proj', '.mcp.json'));
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.claude.json'));
  });
  it('cursor: project → .cursor/mcp.json, global → ~/.cursor/mcp.json', () => {
    const c = clientById('cursor')!;
    expect(c.format).toBe('json');
    expect(c.resolvePath('project', cwd, home)).toBe(join('/proj', '.cursor', 'mcp.json'));
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.cursor', 'mcp.json'));
  });
  it('codex: global-only → ~/.codex/config.toml, toml format', () => {
    const c = clientById('codex')!;
    expect(c.scopes).toEqual(['global']);
    expect(c.format).toBe('toml');
    expect(c.resolvePath('global', cwd, home)).toBe(join('/home/u', '.codex', 'config.toml'));
  });
  it('CLIENTS has all three ids', () => {
    expect(CLIENTS.map((c) => c.id).sort()).toEqual(['claude-code', 'codex', 'cursor']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/clients.test.ts`
Expected: FAIL — cannot resolve `../../src/install/clients.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/cli/src/install/clients.ts
import { join } from 'node:path';

export interface McpEntry {
  command: string;
  args: string[];
}

/** The MCP server entry written for every client. */
export const MCP_ENTRY: McpEntry = { command: 'npx', args: ['-y', '@svelte-vitals/mcp'] };

export type ClientId = 'claude-code' | 'cursor' | 'codex';
export type Scope = 'project' | 'global';

export interface ClientWriter {
  id: ClientId;
  label: string;
  scopes: Scope[];
  format: 'json' | 'toml';
  /** Config file path for a scope. `cwd` = project root, `home` = user home dir. */
  resolvePath(scope: Scope, cwd: string, home: string): string;
}

export const CLIENTS: ClientWriter[] = [
  {
    id: 'claude-code',
    label: 'Claude Code',
    scopes: ['project', 'global'],
    format: 'json',
    resolvePath: (scope, cwd, home) => (scope === 'project' ? join(cwd, '.mcp.json') : join(home, '.claude.json'))
  },
  {
    id: 'cursor',
    label: 'Cursor',
    scopes: ['project', 'global'],
    format: 'json',
    resolvePath: (scope, cwd, home) =>
      scope === 'project' ? join(cwd, '.cursor', 'mcp.json') : join(home, '.cursor', 'mcp.json')
  },
  {
    id: 'codex',
    label: 'Codex',
    scopes: ['global'],
    format: 'toml',
    resolvePath: (_scope, _cwd, home) => join(home, '.codex', 'config.toml')
  }
];

export function clientById(id: ClientId): ClientWriter | undefined {
  return CLIENTS.find((c) => c.id === id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/clients.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/clients.ts packages/cli/test/install/clients.test.ts
git commit -m "feat(cli): install — client writer definitions (paths + format)"
```

---

### Task 2: JSON/TOML merge helpers

**Files:**

- Modify: `pnpm-workspace.yaml` (add `smol-toml` to catalog)
- Modify: `packages/cli/package.json` (add `"smol-toml": "catalog:"` to dependencies)
- Create: `packages/cli/src/install/merge.ts`
- Test: `packages/cli/test/install/merge.test.ts`

**Interfaces:**

- Consumes: `McpEntry`, `MCP_ENTRY` from `./clients.js`.
- Produces: `MergeStatus` (`'created' | 'added' | 'exists' | 'updated'`), `MergeResult` (`{ content: string; status: MergeStatus }`), `mergeJson(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult`, `mergeToml(existing, entry, force): MergeResult`.

- [ ] **Step 1: Add the smol-toml dependency**

In `pnpm-workspace.yaml`, under `catalog:`, add (keep alphabetical-ish with neighbors):

```yaml
smol-toml: ^1.4.1
```

In `packages/cli/package.json` `dependencies`, add:

```json
    "smol-toml": "catalog:",
```

Then install:

Run: `pnpm install`
Expected: lockfile updates; `smol-toml` resolves. If pnpm reports the range is unsatisfiable, bump to the latest published caret it names and re-run.

- [ ] **Step 2: Write the failing test**

```ts
// packages/cli/test/install/merge.test.ts
import { describe, it, expect } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { mergeJson, mergeToml } from '../../src/install/merge.js';
import { MCP_ENTRY } from '../../src/install/clients.js';

describe('mergeJson', () => {
  it('creates a new config when none exists', () => {
    const r = mergeJson(undefined, MCP_ENTRY, false);
    expect(r.status).toBe('created');
    expect(JSON.parse(r.content)).toEqual({
      mcpServers: { 'svelte-vitals': { command: 'npx', args: ['-y', '@svelte-vitals/mcp'] } }
    });
    expect(r.content.endsWith('\n')).toBe(true);
  });
  it('adds to an existing config without clobbering other servers', () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: 'x', args: [] } } });
    const r = mergeJson(existing, MCP_ENTRY, false);
    expect(r.status).toBe('added');
    const parsed = JSON.parse(r.content);
    expect(parsed.mcpServers.other).toEqual({ command: 'x', args: [] });
    expect(parsed.mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('preserves unrelated top-level keys', () => {
    const existing = JSON.stringify({ theme: 'dark', mcpServers: {} });
    const r = mergeJson(existing, MCP_ENTRY, false);
    expect(JSON.parse(r.content).theme).toBe('dark');
  });
  it('is exists (no change) when already identical', () => {
    const first = mergeJson(undefined, MCP_ENTRY, false).content;
    expect(mergeJson(first, MCP_ENTRY, false).status).toBe('exists');
  });
  it('skips a differing entry without force; updates with force', () => {
    const existing = JSON.stringify({ mcpServers: { 'svelte-vitals': { command: 'old', args: [] } } });
    expect(mergeJson(existing, MCP_ENTRY, false).status).toBe('exists');
    const forced = mergeJson(existing, MCP_ENTRY, true);
    expect(forced.status).toBe('updated');
    expect(JSON.parse(forced.content).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('throws on unparseable existing content', () => {
    expect(() => mergeJson('{not json', MCP_ENTRY, false)).toThrow();
  });
});

describe('mergeToml', () => {
  it('creates a new toml config', () => {
    const r = mergeToml(undefined, MCP_ENTRY, false);
    expect(r.status).toBe('created');
    const parsed = parseToml(r.content) as Record<string, any>;
    expect(parsed.mcp_servers['svelte-vitals']).toEqual({ command: 'npx', args: ['-y', '@svelte-vitals/mcp'] });
  });
  it('adds without clobbering existing tables or scalars', () => {
    const existing = 'model = "gpt"\n\n[mcp_servers.other]\ncommand = "x"\nargs = []\n';
    const r = mergeToml(existing, MCP_ENTRY, false);
    expect(r.status).toBe('added');
    const parsed = parseToml(r.content) as Record<string, any>;
    expect(parsed.model).toBe('gpt');
    expect(parsed.mcp_servers.other.command).toBe('x');
    expect(parsed.mcp_servers['svelte-vitals'].command).toBe('npx');
  });
  it('exists when identical; updates with force', () => {
    const first = mergeToml(undefined, MCP_ENTRY, false).content;
    expect(mergeToml(first, MCP_ENTRY, false).status).toBe('exists');
    const existing = '[mcp_servers.svelte-vitals]\ncommand = "old"\nargs = []\n';
    expect(mergeToml(existing, MCP_ENTRY, false).status).toBe('exists');
    expect(mergeToml(existing, MCP_ENTRY, true).status).toBe('updated');
  });
  it('throws on unparseable toml', () => {
    expect(() => mergeToml('= = =', MCP_ENTRY, false)).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/merge.test.ts`
Expected: FAIL — cannot resolve `../../src/install/merge.js`.

- [ ] **Step 4: Write minimal implementation**

```ts
// packages/cli/src/install/merge.ts
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { type McpEntry } from './clients.js';

export type MergeStatus = 'created' | 'added' | 'exists' | 'updated';
export interface MergeResult {
  content: string;
  status: MergeStatus;
}

const SERVER_KEY = 'svelte-vitals';

function sameEntry(prior: unknown, entry: McpEntry): boolean {
  if (typeof prior !== 'object' || prior === null) return false;
  const o = prior as { command?: unknown; args?: unknown };
  return (
    o.command === entry.command &&
    Array.isArray(o.args) &&
    o.args.length === entry.args.length &&
    o.args.every((v, i) => v === entry.args[i])
  );
}

/** Decide the merge status for a table that may already hold a svelte-vitals key. */
function statusFor(prior: unknown, entry: McpEntry, force: boolean, created: boolean): MergeStatus | 'skip' {
  if (prior !== undefined) {
    if (sameEntry(prior, entry)) return 'exists';
    return force ? 'updated' : 'skip';
  }
  return created ? 'created' : 'added';
}

/** Merge the svelte-vitals server into a JSON `{ mcpServers: {...} }` config. */
export function mergeJson(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult {
  const created = existing === undefined;
  const root: Record<string, unknown> = created ? {} : (JSON.parse(existing) as Record<string, unknown>);
  const servers =
    typeof root.mcpServers === 'object' && root.mcpServers !== null ? (root.mcpServers as Record<string, unknown>) : {};
  const status = statusFor(servers[SERVER_KEY], entry, force, created);
  if (status === 'exists' || status === 'skip') return { content: existing as string, status: 'exists' };
  servers[SERVER_KEY] = { command: entry.command, args: entry.args };
  root.mcpServers = servers;
  return { content: JSON.stringify(root, null, 2) + '\n', status };
}

/** Merge the svelte-vitals server into a TOML config under [mcp_servers.svelte-vitals]. */
export function mergeToml(existing: string | undefined, entry: McpEntry, force: boolean): MergeResult {
  const created = existing === undefined;
  const root = (created ? {} : parseToml(existing)) as Record<string, unknown>;
  const servers =
    typeof root.mcp_servers === 'object' && root.mcp_servers !== null
      ? (root.mcp_servers as Record<string, unknown>)
      : {};
  const status = statusFor(servers[SERVER_KEY], entry, force, created);
  if (status === 'exists' || status === 'skip') return { content: existing as string, status: 'exists' };
  servers[SERVER_KEY] = { command: entry.command, args: entry.args };
  root.mcp_servers = servers;
  return { content: stringifyToml(root), status };
}
```

Note: when a differing entry exists and `force` is false, `statusFor` returns `'skip'`, which both merge functions collapse to a no-write `'exists'` result (the caller surfaces "already configured — use --force"). This keeps the four spec statuses.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/merge.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/cli/package.json packages/cli/src/install/merge.ts packages/cli/test/install/merge.test.ts
git commit -m "feat(cli): install — pure JSON/TOML config merge (adds smol-toml)"
```

---

### Task 3: runInstall orchestration

**Files:**

- Create: `packages/cli/src/install/index.ts`
- Test: `packages/cli/test/install/run.test.ts`

**Interfaces:**

- Consumes: `CLIENTS`, `clientById`, `MCP_ENTRY`, `ClientId`, `ClientWriter`, `Scope` from `./clients.js`; `mergeJson`, `mergeToml`, `MergeStatus` from `./merge.js`.
- Produces: `InstallIO`, `InstallPrompts`, `InstallFlags`, `runInstall(flags: InstallFlags, io: InstallIO, prompts: InstallPrompts): Promise<number>`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/test/install/run.test.ts
import { describe, it, expect } from 'vitest';
import { runInstall, type InstallIO, type InstallPrompts } from '../../src/install/index.js';

function fakeIO(over: { files?: Record<string, string>; isTTY?: boolean } = {}) {
  const files = over.files ?? {};
  const writes: Record<string, string> = {};
  const out: string[] = [];
  const err: string[] = [];
  const io: InstallIO = {
    readFile: (p) => files[p],
    writeFile: (p, c) => {
      writes[p] = c;
    },
    cwd: '/proj',
    home: '/home/u',
    isTTY: over.isTTY ?? false,
    log: (l) => out.push(l),
    errorLog: (l) => err.push(l)
  };
  return { io, writes, out, err };
}

const noPrompts: InstallPrompts = {
  selectClients: async () => null,
  selectScope: async () => null,
  confirm: async () => true
};

describe('runInstall', () => {
  it('non-TTY without --client exits 2 with guidance', async () => {
    const { io, err } = fakeIO();
    expect(await runInstall({}, io, noPrompts)).toBe(2);
    expect(err.join('\n')).toContain('--client');
  });
  it('flag-only writes the selected client config', async () => {
    const { io, writes } = fakeIO();
    expect(await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, io, noPrompts)).toBe(0);
    expect(Object.keys(writes)).toEqual(['/proj/.mcp.json']);
    expect(JSON.parse(writes['/proj/.mcp.json']).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('dry-run writes nothing', async () => {
    const { io, writes, out } = fakeIO();
    expect(await runInstall({ client: ['cursor'], scope: 'global', dryRun: true }, io, noPrompts)).toBe(0);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('Dry run');
  });
  it('codex ignores scope and uses the global config.toml', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['codex'], yes: true }, io, noPrompts);
    expect(Object.keys(writes)).toEqual(['/home/u/.codex/config.toml']);
  });
  it('an existing identical entry is skipped (no write)', async () => {
    const first = fakeIO();
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, first.io, noPrompts);
    const content = first.writes['/proj/.mcp.json'];
    const { io, writes, out } = fakeIO({ files: { '/proj/.mcp.json': content } });
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true }, io, noPrompts);
    expect(writes).toEqual({});
    expect(out.join('\n')).toContain('already configured');
  });
  it('force overwrites a differing entry', async () => {
    const existing = JSON.stringify({ mcpServers: { 'svelte-vitals': { command: 'old', args: [] } } });
    const { io, writes } = fakeIO({ files: { '/proj/.mcp.json': existing } });
    await runInstall({ client: ['claude-code'], scope: 'project', yes: true, force: true }, io, noPrompts);
    expect(JSON.parse(writes['/proj/.mcp.json']).mcpServers['svelte-vitals'].command).toBe('npx');
  });
  it('a multi-client plan writes each config', async () => {
    const { io, writes } = fakeIO();
    await runInstall({ client: ['claude-code', 'cursor'], scope: 'project', yes: true }, io, noPrompts);
    expect(Object.keys(writes).sort()).toEqual(['/proj/.cursor/mcp.json', '/proj/.mcp.json']);
  });
  it('TTY confirm=false writes nothing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, confirm: async () => false };
    expect(await runInstall({ client: ['claude-code'], scope: 'project' }, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
  it('TTY client-picker cancel exits 0 without writing', async () => {
    const { io, writes } = fakeIO({ isTTY: true });
    const prompts: InstallPrompts = { ...noPrompts, selectClients: async () => null };
    expect(await runInstall({}, io, prompts)).toBe(0);
    expect(writes).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/run.test.ts`
Expected: FAIL — cannot resolve `../../src/install/index.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/cli/src/install/index.ts
import { CLIENTS, clientById, MCP_ENTRY, type ClientId, type ClientWriter, type Scope } from './clients.js';
import { mergeJson, mergeToml, type MergeStatus } from './merge.js';

export interface InstallIO {
  /** File contents, or undefined if the file does not exist. */
  readFile(path: string): string | undefined;
  /** Write the file, creating parent directories as needed. */
  writeFile(path: string, content: string): void;
  cwd: string;
  home: string;
  isTTY: boolean;
  log(line: string): void;
  errorLog(line: string): void;
}

export interface InstallPrompts {
  /** Returns chosen client ids, or null when cancelled. */
  selectClients(all: ClientWriter[], defaults: ClientId[]): Promise<ClientId[] | null>;
  /** Returns chosen scope, or null when cancelled. */
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

interface PlanRow {
  client: ClientWriter;
  scope: Scope;
  path: string;
  status: MergeStatus;
  content: string;
}

function planFor(client: ClientWriter, scope: Scope, io: InstallIO, force: boolean): PlanRow {
  const path = client.resolvePath(scope, io.cwd, io.home);
  const existing = io.readFile(path);
  const merged =
    client.format === 'toml' ? mergeToml(existing, MCP_ENTRY, force) : mergeJson(existing, MCP_ENTRY, force);
  return { client, scope, path, status: merged.status, content: merged.content };
}

export async function runInstall(flags: InstallFlags, io: InstallIO, prompts: InstallPrompts): Promise<number> {
  // 1. Select clients.
  let ids: ClientId[];
  if (flags.client && flags.client.length > 0) {
    ids = flags.client;
  } else if (io.isTTY) {
    const detected = CLIENTS.filter((c) =>
      c.scopes.some((s) => io.readFile(c.resolvePath(s, io.cwd, io.home)) !== undefined)
    ).map((c) => c.id);
    const picked = await prompts.selectClients(CLIENTS, detected);
    if (picked === null) {
      io.log('Cancelled.');
      return 0;
    }
    ids = picked;
  } else {
    io.errorLog('svelte-vitals: no TTY; pass --client <claude-code,cursor,codex> to install non-interactively.');
    return 2;
  }

  const clients = ids.map(clientById).filter((c): c is ClientWriter => c !== undefined);
  if (clients.length === 0) {
    io.errorLog('svelte-vitals: no valid clients selected.');
    return 2;
  }

  // 2. Resolve a scope per client and build the plan.
  const rows: PlanRow[] = [];
  for (const client of clients) {
    let scope: Scope;
    if (client.scopes.length === 1) {
      scope = client.scopes[0];
    } else if (flags.scope) {
      scope = flags.scope;
    } else if (io.isTTY) {
      const picked = await prompts.selectScope(client);
      if (picked === null) {
        io.log('Cancelled.');
        return 0;
      }
      scope = picked;
    } else {
      scope = 'project';
    }
    rows.push(planFor(client, scope, io, flags.force ?? false));
  }

  // 3. Preview.
  const planText = rows.map((r) => `  ${r.client.label} (${r.scope}) → ${r.path}  [${r.status}]`).join('\n');
  io.log('Plan:');
  io.log(planText);

  // 4. Dry-run / confirm.
  if (flags.dryRun) {
    io.log('Dry run — no files written.');
    return 0;
  }
  if (!flags.yes && io.isTTY) {
    const ok = await prompts.confirm(planText);
    if (!ok) {
      io.log('Cancelled.');
      return 0;
    }
  }

  // 5. Write.
  try {
    for (const r of rows) {
      if (r.status === 'exists') {
        io.log(`= ${r.client.label}: already configured (${r.path}) — use --force to overwrite.`);
        continue;
      }
      io.writeFile(r.path, r.content);
      io.log(`✓ ${r.client.label}: ${r.status} ${r.path}`);
    }
  } catch (err) {
    io.errorLog(`svelte-vitals: failed to write config: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  io.log('');
  io.log('Done. Restart your client to load the svelte-vitals MCP server.');
  return 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/run.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/index.ts packages/cli/test/install/run.test.ts
git commit -m "feat(cli): install — runInstall orchestration (injected IO + prompts)"
```

---

### Task 4: Install flag parsing

**Files:**

- Create: `packages/cli/src/install/args.ts`
- Test: `packages/cli/test/install/args.test.ts`

**Interfaces:**

- Consumes: `ClientId`, `Scope` from `./clients.js`; `InstallFlags` from `./index.js`.
- Produces: `ResolvedInstallArgs` (`{ flags: InstallFlags | null; warnings: string[]; errors: string[] }`), `resolveInstallArgs(argv: mri.Argv): ResolvedInstallArgs`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/cli/test/install/args.test.ts
import { describe, it, expect } from 'vitest';
import mri from 'mri';
import { resolveInstallArgs } from '../../src/install/args.js';

const parse = (args: string[]) =>
  mri(args, { boolean: ['yes', 'dry-run', 'force'], string: ['client', 'scope'], alias: { y: 'yes' } });

describe('resolveInstallArgs', () => {
  it('parses clients and scope', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,cursor', '--scope', 'project']));
    expect(r.flags).toEqual({
      client: ['claude-code', 'cursor'],
      scope: 'project',
      yes: false,
      dryRun: false,
      force: false
    });
  });
  it('warns and drops unknown client ids', () => {
    const r = resolveInstallArgs(parse(['--client', 'claude-code,bogus']));
    expect(r.flags!.client).toEqual(['claude-code']);
    expect(r.warnings.join('\n')).toContain('bogus');
  });
  it('errors on an invalid scope (fatal)', () => {
    const r = resolveInstallArgs(parse(['--scope', 'weird']));
    expect(r.flags).toBeNull();
    expect(r.errors.join('\n')).toContain('weird');
  });
  it('maps -y, --dry-run, --force', () => {
    const r = resolveInstallArgs(parse(['-y', '--dry-run', '--force']));
    expect(r.flags).toMatchObject({ yes: true, dryRun: true, force: true });
  });
  it('omits client/scope keys when not provided', () => {
    const r = resolveInstallArgs(parse([]));
    expect(r.flags).toEqual({ yes: false, dryRun: false, force: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/args.test.ts`
Expected: FAIL — cannot resolve `../../src/install/args.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/cli/src/install/args.ts
import type mri from 'mri';
import type { ClientId, Scope } from './clients.js';
import type { InstallFlags } from './index.js';

const VALID_CLIENTS: readonly ClientId[] = ['claude-code', 'cursor', 'codex'];

export interface ResolvedInstallArgs {
  /** Flags to pass to runInstall, or null when a fatal (exit-2) error was found. */
  flags: InstallFlags | null;
  warnings: string[];
  errors: string[];
}

export function resolveInstallArgs(argv: mri.Argv): ResolvedInstallArgs {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawClients =
    typeof argv.client === 'string'
      ? argv.client
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const client: ClientId[] = [];
  for (const c of rawClients) {
    if ((VALID_CLIENTS as readonly string[]).includes(c)) client.push(c as ClientId);
    else warnings.push(`svelte-vitals: unknown --client '${c}'; expected claude-code|cursor|codex. Skipping.`);
  }

  let scope: Scope | undefined;
  const rawScope = argv.scope;
  if (typeof rawScope === 'string') {
    if (rawScope === 'project' || rawScope === 'global') scope = rawScope;
    else errors.push(`svelte-vitals: unknown --scope '${rawScope}'; expected project|global.`);
  }

  if (errors.length > 0) return { flags: null, warnings, errors };

  return {
    flags: {
      ...(client.length > 0 ? { client } : {}),
      ...(scope ? { scope } : {}),
      yes: Boolean(argv.yes),
      dryRun: Boolean(argv['dry-run']),
      force: Boolean(argv.force)
    },
    warnings,
    errors
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter svelte-vitals exec vitest run test/install/args.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/install/args.ts packages/cli/test/install/args.test.ts
git commit -m "feat(cli): install — pure flag parsing (resolveInstallArgs)"
```

---

### Task 5: Wire the `install` subcommand into bin.ts

**Files:**

- Modify: `pnpm-workspace.yaml` (add `@clack/prompts` to catalog)
- Modify: `packages/cli/package.json` (add `"@clack/prompts": "catalog:"`)
- Create: `packages/cli/src/install/cli.ts` (real IO + clack adapter + `runInstallCli`)
- Modify: `packages/cli/src/bin.ts` (subcommand routing + help)
- Create: `.changeset/cli-install-wizard.md`

**Interfaces:**

- Consumes: `runInstall`, `InstallIO`, `InstallPrompts` from `./index.js`; `resolveInstallArgs` from `./args.js`; `ClientId`, `ClientWriter`, `Scope` from `./clients.js`.
- Produces: `runInstallCli(args: string[]): Promise<number>`.

- [ ] **Step 1: Add the @clack/prompts dependency**

In `pnpm-workspace.yaml` under `catalog:`, add:

```yaml
'@clack/prompts': ^0.11.0
```

In `packages/cli/package.json` `dependencies`, add:

```json
    "@clack/prompts": "catalog:",
```

Run: `pnpm install`
Expected: lockfile updates; `@clack/prompts` resolves. If the range is unsatisfiable, bump to the latest published caret pnpm names and re-run.

- [ ] **Step 2: Create the clack adapter + CLI entry**

```ts
// packages/cli/src/install/cli.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import mri from 'mri';
import * as p from '@clack/prompts';
import { runInstall, type InstallIO, type InstallPrompts } from './index.js';
import { resolveInstallArgs } from './args.js';
import type { ClientId, ClientWriter, Scope } from './clients.js';

const INSTALL_HELP = `svelte-vitals install — set up the svelte-vitals MCP server for your AI-agent clients

Usage:
  svelte-vitals install [options]

Options:
  --client <ids>    Comma-separated: claude-code,cursor,codex (skips the interactive picker)
  --scope <scope>   project | global (applies to all selected clients; codex is always global)
  --yes, -y         Skip the confirmation prompt
  --dry-run         Print the planned changes and exit without writing
  --force           Overwrite an existing svelte-vitals entry
  -h, --help        Show this help`;

function realIO(): InstallIO {
  return {
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch {
        return undefined;
      }
    },
    writeFile: (path, content) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    },
    cwd: process.cwd(),
    home: homedir(),
    isTTY: Boolean(process.stdout.isTTY),
    log: (line) => console.log(line),
    errorLog: (line) => console.error(line)
  };
}

function clackPrompts(): InstallPrompts {
  return {
    selectClients: async (all: ClientWriter[], defaults: ClientId[]) => {
      const res = await p.multiselect({
        message: 'Which clients should svelte-vitals be installed for?',
        options: all.map((c) => ({ value: c.id, label: c.label })),
        initialValues: defaults,
        required: true
      });
      return p.isCancel(res) ? null : (res as ClientId[]);
    },
    selectScope: async (client: ClientWriter) => {
      const res = await p.select({
        message: `Scope for ${client.label}?`,
        options: client.scopes.map((s) => ({ value: s, label: s })),
        initialValue: client.scopes[0]
      });
      return p.isCancel(res) ? null : (res as Scope);
    },
    confirm: async (planText: string) => {
      const res = await p.confirm({ message: `Apply this plan?\n${planText}` });
      return p.isCancel(res) ? false : Boolean(res);
    }
  };
}

/** Parse install args, print diagnostics, and run the wizard. Returns the exit code. */
export async function runInstallCli(args: string[]): Promise<number> {
  const argv = mri(args, {
    boolean: ['yes', 'dry-run', 'force', 'help'],
    string: ['client', 'scope'],
    alias: { y: 'yes', h: 'help' }
  });
  if (argv.help) {
    console.log(INSTALL_HELP);
    return 0;
  }
  const { flags, warnings, errors } = resolveInstallArgs(argv);
  for (const w of warnings) console.error(w);
  for (const e of errors) console.error(e);
  if (!flags) return 2;
  return runInstall(flags, realIO(), clackPrompts());
}
```

- [ ] **Step 3: Route the subcommand in bin.ts**

At the top of `main()` in `packages/cli/src/bin.ts`, before the existing scanner parse, add the subcommand branch. Add the import near the other imports:

```ts
import { runInstallCli } from './install/cli.js';
```

Then inside `main()`, as the first statements:

```ts
const rawArgs = process.argv.slice(2);
if (rawArgs[0] === 'install') {
  const code = await runInstallCli(rawArgs.slice(1));
  process.exit(code);
}
```

Add a one-line pointer to the top-level `HELP` string. Insert this line into the `Usage:` block (after the `svelte-vitals [path] [options]` line):

```
  svelte-vitals install          Set up the MCP server for Claude Code / Cursor / Codex
```

- [ ] **Step 4: Build and verify the subcommand end-to-end**

Run: `pnpm --filter svelte-vitals build`
Expected: build succeeds; `dist/bin.js` produced.

Run: `node packages/cli/dist/bin.js install --client claude-code --scope project --dry-run`
Expected: prints `Plan:`, a line containing `Claude Code (project)` and a path ending `.mcp.json  [created]`, then `Dry run — no files written.` Exit code 0.

Run (real write into a throwaway dir):

```bash
D=$(mktemp -d) && cd "$D" && node "$OLDPWD/packages/cli/dist/bin.js" install --client cursor --scope project --yes && cat .cursor/mcp.json
```

Expected: `.cursor/mcp.json` contains `mcpServers.svelte-vitals` with `command: "npx"`, `args: ["-y", "@svelte-vitals/mcp"]`.

Run (non-TTY guard — should fail cleanly): `node packages/cli/dist/bin.js install </dev/null`
Expected: stderr contains `--client`; exit code 2.

Run: `node packages/cli/dist/bin.js install --help`
Expected: prints the install help block; exit 0.

Run (existing scanner still works — backward compat): `node packages/cli/dist/bin.js --help`
Expected: prints the top-level scanner help including the new `svelte-vitals install` line.

- [ ] **Step 5: Add the changeset**

```markdown
---
'svelte-vitals': minor
---

Add an interactive `svelte-vitals install` command that sets up the svelte-vitals
MCP server for Claude Code, Cursor, and Codex. It merges into your existing client
config without touching other servers, prompts for the clients and scope
(project/global) interactively, and supports `--client`, `--scope`, `--yes`,
`--dry-run`, and `--force` for non-interactive use.
```

Save as `.changeset/cli-install-wizard.md`.

- [ ] **Step 6: Run the full CLI suite + lint + typecheck**

Run: `pnpm --filter svelte-vitals test`
Expected: all CLI tests pass (existing + new install tests).

Run: `pnpm -r typecheck`
Expected: all packages typecheck clean.

Run: `pnpm lint`
Expected: prettier + eslint clean. If prettier flags files, run `pnpm exec prettier --write .` and re-run.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml packages/cli/package.json packages/cli/src/install/cli.ts packages/cli/src/bin.ts .changeset/cli-install-wizard.md
git commit -m "feat(cli): install subcommand — clack wizard + bin routing + help (adds @clack/prompts)"
```

---

## Self-Review

**Spec coverage:**

- Command surface & flags (spec §1) → Task 4 (parsing) + Task 5 (routing, help, subcommand).
- Client writer modules (spec §2) → Task 1.
- Merge/write safety (spec §3) → Task 2 (pure merge, parse-failure throws) + Task 3 (write via IO).
- Wizard flow (spec §4) → Task 3 (runInstall) + Task 5 (real IO + clack).
- Deps & file layout (spec §5) → Task 2 (smol-toml), Task 5 (@clack/prompts); files created across Tasks 1–5.
- Testing (spec §6) → pure tests in Tasks 1,2,4; orchestration tests in Task 3; end-to-end verification in Task 5.
- Non-goals (spec §7) → nothing built for them. ✓

**Deviation noted:** `InstallIO` carries `log`/`errorLog` (not spelled out in the spec's IO snippet) so orchestration output is injectable and testable. This is an additive superset of the spec and does not change behavior.

**Placeholder scan:** none — every code step contains full code; every run step has an expected result.

**Type consistency:** `InstallIO`/`InstallPrompts`/`InstallFlags` defined in Task 3 are consumed unchanged in Tasks 4–5. `MergeResult`/`MergeStatus` from Task 2 used in Task 3. `ClientId`/`Scope`/`ClientWriter`/`MCP_ENTRY` from Task 1 used throughout. `resolveInstallArgs` (Task 4) → `runInstallCli` (Task 5). Consistent.
