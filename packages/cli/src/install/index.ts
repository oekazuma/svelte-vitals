import { join } from 'node:path';
import { CLIENTS, clientById, MCP_ENTRY, type ClientId, type ClientWriter, type Scope } from './clients.js';
import { mergeJson, mergeToml } from './merge.js';
import { VITE_TARGETS, viteTargetById, isViteTargetId, type ViteTargetId } from './vite-targets.js';
import {
  AGENT_TARGETS,
  agentTargetById,
  isAgentTargetId,
  type AgentTarget,
  type AgentTargetId
} from './agent-targets.js';
import { buildSkillMarkdown, buildCursorRules } from './skill-content.js';
import { codemodViteConfig } from './codemod-vite-config.js';
import { codemodHooksServer } from './codemod-hooks.js';
import { detectPackageManager, hasVitePackage, installCommand, readInstalledViteVersion } from './package-manager.js';
import type { WriteStatus } from './codemod-types.js';

export type TargetId = ClientId | ViteTargetId | AgentTargetId;

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
  /** Run a command (used only to auto-install @svelte-vitals/vite). Returns the exit code. */
  runCommand?(command: string, args: string[], cwd: string): number;
}

export interface SelectableOption {
  id: TargetId;
  label: string;
  hint?: string;
}

export interface InstallPrompts {
  /** Returns chosen target ids (clients and/or Vite targets), or null when cancelled. */
  selectClients(all: SelectableOption[], defaults: TargetId[]): Promise<TargetId[] | null>;
  /** Returns chosen scope, or null when cancelled. */
  selectScope(client: ClientWriter): Promise<Scope | null>;
  confirm(planText: string): Promise<boolean>;
}

export interface InstallFlags {
  client?: TargetId[];
  scope?: Scope;
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
  /** Regenerate only the agent target files (AGENT_TARGETS) that already exist on disk. */
  refresh?: boolean;
}

interface PlanRow {
  id: TargetId;
  label: string;
  scope?: Scope;
  path: string;
  status: WriteStatus;
  content?: string;
  snippet?: string;
}

function planForClient(client: ClientWriter, scope: Scope, io: InstallIO, force: boolean): PlanRow {
  const path = client.resolvePath(scope, io.cwd, io.home);
  const existing = io.readFile(path);
  const merged =
    client.format === 'toml' ? mergeToml(existing, MCP_ENTRY, force) : mergeJson(existing, MCP_ENTRY, force);
  return { id: client.id, label: client.label, scope, path, status: merged.status, content: merged.content };
}

/** Read the first candidate path that exists; otherwise report the first candidate as the (nonexistent) path. */
function resolveCandidate(io: InstallIO, candidates: string[]): { path: string; content: string | undefined } {
  for (const rel of candidates) {
    const path = join(io.cwd, rel);
    const content = io.readFile(path);
    if (content !== undefined) return { path, content };
  }
  return { path: join(io.cwd, candidates[0]!), content: undefined };
}

function planForVitePlugin(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']);
  const result = codemodViteConfig(content);
  return { id: 'vite-plugin', label: viteTargetById('vite-plugin')!.label, path, ...result };
}

function planForViteHooks(io: InstallIO): PlanRow {
  const { path, content } = resolveCandidate(io, ['src/hooks.server.ts', 'src/hooks.server.js']);
  const result = codemodHooksServer(content);
  return { id: 'vite-hooks', label: viteTargetById('vite-hooks')!.label, path, ...result };
}

/**
 * Plan a generated agent instruction file (Claude Code skill / Cursor rules). Unlike the
 * Vite targets, content here is fully regenerated from core's rule metadata rather than
 * codemodded, so --force is allowed to overwrite an existing file.
 */
function planForAgentTarget(target: AgentTarget, io: InstallIO, force: boolean, version: string): PlanRow {
  const path = join(io.cwd, target.relPath);
  const existing = io.readFile(path);
  const content = target.id === 'claude-skill' ? buildSkillMarkdown(version) : buildCursorRules(version);
  const status: WriteStatus = existing === undefined ? 'created' : force ? 'updated' : 'exists';
  return { id: target.id, label: target.label, path, status, content };
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n');
}

function rowLine(r: PlanRow): string {
  const head = `  ${r.label}${r.scope ? ` (${r.scope})` : ''} → ${r.path}  [${r.status}]`;
  return r.status === 'manual' && r.snippet ? `${head}\n${indent(r.snippet)}` : head;
}

/**
 * Regenerate whichever AGENT_TARGETS files already exist on disk, with the current rule set.
 * Unlike a normal install, this never creates a file that isn't already there — it's a
 * maintenance command for keeping previously-generated agent files fresh, not an install path.
 */
async function runRefresh(io: InstallIO, flags: InstallFlags, version: string): Promise<number> {
  let hadFailure = false;
  const rows: PlanRow[] = [];
  for (const target of AGENT_TARGETS) {
    const path = join(io.cwd, target.relPath);
    // readFile maps only ENOENT to undefined and rethrows everything else (EACCES, EISDIR, …),
    // so treat a per-target read failure like a per-target write failure: report it, keep
    // refreshing the other targets, and exit 2 at the end. planForAgentTarget re-reads the
    // file internally, so it sits inside the same try.
    try {
      if (io.readFile(path) === undefined) continue;
      rows.push(planForAgentTarget(target, io, /* force */ true, version));
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (rows.length === 0) {
    // A failed read means we can't tell whether that target's file exists, so the
    // "nothing installed yet" guidance would be misleading — the read error above is
    // the actionable message.
    if (hadFailure) return 2;
    io.errorLog(
      'svelte-vitals: no generated agent files found — run `svelte-vitals install --client claude-skill,cursor-rules` first.'
    );
    return 0;
  }

  const planText = rows.map(rowLine).join('\n');
  io.log('Plan:');
  io.log(planText);

  if (flags.dryRun) {
    io.log('Dry run — no files written.');
    return hadFailure ? 2 : 0;
  }

  for (const r of rows) {
    try {
      io.writeFile(r.path, r.content ?? '');
      io.log(`✓ ${r.label}: ${r.status} ${r.path}`);
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to write ${r.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (hadFailure) return 2;

  io.log('');
  io.log(`✓ refreshed ${rows.length} file(s).`);
  return 0;
}

export async function runInstall(
  flags: InstallFlags,
  io: InstallIO,
  prompts: InstallPrompts,
  version = '0.0.0'
): Promise<number> {
  if (flags.refresh) {
    return runRefresh(io, flags, version);
  }

  // 1. Select clients / targets.
  let ids: TargetId[];
  if (flags.client && flags.client.length > 0) {
    ids = flags.client;
  } else if (io.isTTY) {
    const configExists = (path: string): boolean => {
      try {
        return io.readFile(path) !== undefined;
      } catch {
        return false;
      }
    };
    const detectedClients = CLIENTS.filter((c) =>
      c.scopes.some((s) => configExists(c.resolvePath(s, io.cwd, io.home)))
    ).map((c) => c.id);
    const viteConfigExists = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].some((f) =>
      configExists(join(io.cwd, f))
    );
    const claudeSkillDetected = configExists(join(io.cwd, '.claude', 'settings.json'));
    const cursorRulesDetected = configExists(join(io.cwd, '.cursor', 'mcp.json'));
    const detectedAgents: AgentTargetId[] = [
      ...(claudeSkillDetected ? (['claude-skill'] as const) : []),
      ...(cursorRulesDetected ? (['cursor-rules'] as const) : [])
    ];
    const detected: TargetId[] = [
      ...detectedClients,
      ...(viteConfigExists ? VITE_TARGETS.map((t) => t.id) : []),
      ...detectedAgents
    ];
    const options: SelectableOption[] = [
      ...CLIENTS.map((c) => ({ id: c.id, label: c.label })),
      ...VITE_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint })),
      ...AGENT_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))
    ];
    const picked = await prompts.selectClients(options, detected);
    if (picked === null) {
      io.log('Cancelled.');
      return 0;
    }
    ids = picked;
  } else {
    io.errorLog(
      'svelte-vitals: no TTY; pass --client <claude-code,cursor,codex,vite-plugin,vite-hooks,claude-skill,cursor-rules> to install non-interactively.'
    );
    return 2;
  }

  const clients = ids.map(clientById).filter((c): c is ClientWriter => c !== undefined);
  const viteIds = ids.filter(isViteTargetId);
  const agentIds = ids.filter(isAgentTargetId);
  if (clients.length === 0 && viteIds.length === 0 && agentIds.length === 0) {
    io.errorLog('svelte-vitals: no valid clients or targets selected.');
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
    try {
      rows.push(planForClient(client, scope, io, flags.force ?? false));
    } catch (err) {
      const path = client.resolvePath(scope, io.cwd, io.home);
      io.errorLog(
        `svelte-vitals: could not parse existing config at ${path}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }
  for (const viteId of viteIds) {
    rows.push(viteId === 'vite-plugin' ? planForVitePlugin(io) : planForViteHooks(io));
  }
  for (const agentId of agentIds) {
    const target = agentTargetById(agentId)!;
    rows.push(planForAgentTarget(target, io, flags.force ?? false, version));
  }

  // 3. Preview.
  const planText = rows.map(rowLine).join('\n');
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
  let hadFailure = false;
  let viteWasWritten = false;
  for (const r of rows) {
    if (r.status === 'exists') {
      // --force never applies to the two Vite targets (see Global Constraints), so the
      // "use --force" hint would be misleading for them.
      const hint = isViteTargetId(r.id) ? '' : ' — use --force to overwrite';
      io.log(`= ${r.label}: already configured (${r.path})${hint}.`);
      continue;
    }
    if (r.status === 'manual') {
      io.log(`! ${r.label}: couldn't safely modify ${r.path} — add this by hand:\n${indent(r.snippet ?? '')}`);
      continue;
    }
    try {
      io.writeFile(r.path, r.content ?? '');
      io.log(`✓ ${r.label}: ${r.status} ${r.path}`);
      if (isViteTargetId(r.id)) viteWasWritten = true;
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to write ${r.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // 6. Auto-install @svelte-vitals/vite if a Vite target was actually written —
  // run this even if another row failed, so a partial failure elsewhere doesn't
  // silently strand a freshly-registered vite.config without its dependency
  // (once written, the codemod reports 'exists' on every later run, so this is
  // the only chance to install it).
  if (viteWasWritten && io.runCommand && !hasVitePackage(io)) {
    const pm = detectPackageManager(io);
    const { command, args } = installCommand(pm);
    io.log(`Installing @svelte-vitals/vite via ${pm}...`);
    const code = io.runCommand(command, args, io.cwd);
    if (code !== 0) {
      io.errorLog(
        `svelte-vitals: failed to install @svelte-vitals/vite (${command} ${args.join(' ')} exited ${code}). Install it manually.`
      );
    } else {
      const installedVersion = readInstalledViteVersion(io);
      io.log(
        installedVersion
          ? `svelte-vitals: installed @svelte-vitals/vite@${installedVersion} — compare against \`svelte-vitals --version\`'s core number if findings ever seem out of sync.`
          : 'svelte-vitals: installed @svelte-vitals/vite (could not read the installed version from node_modules).'
      );
    }
  }

  if (hadFailure) return 2;

  io.log('');
  if (clients.length > 0) io.log('Restart your client to load the svelte-vitals MCP server.');
  if (viteWasWritten) io.log('Restart `vite dev` (or your build) to pick up the change.');
  io.log('Done.');
  return 0;
}
