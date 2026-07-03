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
      scope = client.scopes[0]!;
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
