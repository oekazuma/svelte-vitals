import { join } from 'node:path';
import { VITE_TARGETS, viteTargetById, isViteTargetId, type ViteTargetId } from './vite-targets.js';
import {
  AGENT_TARGETS,
  agentTargetById,
  isAgentTargetId,
  type AgentTarget,
  type AgentTargetId
} from './agent-targets.js';
import {
  CONFIG_TARGETS,
  configTargetById,
  isConfigTargetId,
  type ConfigTarget,
  type ConfigTargetId
} from './config-targets.js';
import { CI_TARGETS, ciTargetById, isCiTargetId, type CiTarget, type CiTargetId } from './ci-targets.js';
import { buildSkillMarkdown, buildCursorRules } from './skill-content.js';
import { buildImproveSkillMarkdown } from './improve-skill-content.js';
import { buildConfigFileTemplate } from './config-content.js';
import {
  findExistingConfigFile,
  detectBestConfigExtension,
  hasSvelteVitalsDependency,
  isEsmProject
} from './config-file-format.js';
import { codemodViteConfig } from './codemod-vite-config.js';
import { codemodHooksServer } from './codemod-hooks.js';
import {
  detectPackageManager,
  detectPackageManagerFromLockfile,
  hasVitePackage,
  installCommand,
  readInstalledViteVersion
} from './package-manager.js';
import type { WriteStatus } from './codemod-types.js';
import { planWorkflowWrite, buildWorkflowYaml } from '../ci/workflow.js';
import { ACTION_SHA, ACTION_VERSION } from '../ci/action-pin.generated.js';
import { discoverApps } from '../discover-apps.js';

export type TargetId = ViteTargetId | AgentTargetId | ConfigTargetId | CiTargetId;

export interface InstallIO {
  /** File contents, or undefined if the file does not exist. */
  readFile(path: string): string | undefined;
  /** Write the file, creating parent directories as needed. */
  writeFile(path: string, content: string): void;
  cwd: string;
  isTTY: boolean;
  log(line: string): void;
  errorLog(line: string): void;
  /** Run a command (used only to auto-install @svelte-vitals/vite). Returns the exit code. */
  runCommand?(command: string, args: string[], cwd: string): number;
  /** `process.version` — used only to decide whether a fresh config-file scaffold can pick
   * `.ts` (native TypeScript stripping support). Falls back to `process.version` if omitted. */
  nodeVersion?: string;
  /** Monorepo SvelteKit-app discovery (the analyzer's own `discoverApps`). Injectable for
   * tests, which use a virtual filesystem the real (fs-backed) implementation can't see. */
  discoverApps?(cwd: string): Promise<string[]>;
}

export interface SelectableOption {
  id: TargetId;
  label: string;
  hint?: string;
}

export interface InstallPrompts {
  /**
   * Returns chosen target ids, or null when cancelled. Options are pre-grouped by
   * category (group label → options) so the picker can render them as distinct
   * sections (Vite integration / Agent Skills & rules / CI / Config file) instead of
   * one flat list.
   */
  selectClients(groups: Record<string, SelectableOption[]>, defaults: TargetId[]): Promise<TargetId[] | null>;
  /** Monorepo: returns the chosen app directory (cwd-relative), or null when cancelled. */
  selectApp(apps: string[]): Promise<string | null>;
  confirm(planText: string): Promise<boolean>;
}

export interface InstallFlags {
  client?: TargetId[];
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
  /** Regenerate only the agent target files (AGENT_TARGETS) that already exist on disk. */
  refresh?: boolean;
  /** Monorepo: cwd-relative SvelteKit app directory the app-scoped targets (vite-plugin,
   * vite-hooks, config-file) should write into. Skips app auto-detection when given. */
  app?: string;
}

interface PlanRow {
  id: TargetId;
  label: string;
  path: string;
  status: WriteStatus;
  content?: string;
  snippet?: string;
}

/**
 * Package-manager detection for a monorepo app dir: the app's own lockfile wins if it
 * has one (including a real package-lock.json — distinct from npm-as-fallback), but in
 * a workspace setup the lockfile lives at the repo root, so fall back to detecting
 * from cwd. `detectPackageManager` alone would default to npm for an app dir inside a
 * pnpm workspace — the exact case this exists for.
 */
function detectPackageManagerNear(io: InstallIO, appDir: string): ReturnType<typeof detectPackageManager> {
  return detectPackageManagerFromLockfile({ ...io, cwd: appDir }) ?? detectPackageManager(io);
}

/** Read the first candidate path that exists; otherwise report the first candidate as the (nonexistent) path. */
function resolveCandidate(
  io: InstallIO,
  baseDir: string,
  candidates: string[]
): { path: string; content: string | undefined } {
  for (const rel of candidates) {
    const path = join(baseDir, rel);
    const content = io.readFile(path);
    if (content !== undefined) return { path, content };
  }
  return { path: join(baseDir, candidates[0]!), content: undefined };
}

function planForVitePlugin(io: InstallIO, appDir: string): PlanRow {
  const { path, content } = resolveCandidate(io, appDir, ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']);
  const result = codemodViteConfig(content);
  return { id: 'vite-plugin', label: viteTargetById('vite-plugin')!.label, path, ...result };
}

function planForViteHooks(io: InstallIO, appDir: string): PlanRow {
  const { path, content } = resolveCandidate(io, appDir, ['src/hooks.server.ts', 'src/hooks.server.js']);
  const result = codemodHooksServer(content);
  return { id: 'vite-hooks', label: viteTargetById('vite-hooks')!.label, path, ...result };
}

/**
 * Plan a generated agent instruction file (Claude Code skill / Cursor rules). Unlike the
 * Vite targets, content here is fully regenerated from core's rule metadata rather than
 * codemodded, so --force is allowed to overwrite an existing file.
 */
function agentTargetContent(id: AgentTargetId, version: string): string {
  switch (id) {
    case 'claude-skill':
      return buildSkillMarkdown(version);
    case 'cursor-rules':
      return buildCursorRules(version);
    case 'claude-skill-improve':
      return buildImproveSkillMarkdown(version);
    default: {
      // Exhaustiveness check: if AgentTargetId ever gains a new member without a
      // case here, this assignment fails to compile instead of silently falling
      // through to the wrong content at runtime.
      const _exhaustive: never = id;
      throw new Error(`svelte-vitals: unhandled agent target id: ${String(_exhaustive)}`);
    }
  }
}

function planForAgentTarget(target: AgentTarget, io: InstallIO, force: boolean, version: string): PlanRow[] {
  const content = agentTargetContent(target.id, version);
  return target.relPaths.map((relPath) => {
    const path = join(io.cwd, relPath);
    const existing = io.readFile(path);
    const status: WriteStatus = existing === undefined ? 'created' : force ? 'updated' : 'exists';
    return { id: target.id, label: target.label, path, status, content };
  });
}

/**
 * Plan the config-file scaffolder (`svelte-vitals.config.{mjs,js,ts}`). Like the agent
 * targets, content here is a fixed, fully-regenerated template rather than codemodded, so
 * --force is allowed to overwrite an existing file.
 *
 * Extension handling: if a config file already exists (any of the candidates in
 * `loadConfigFile`'s search order), --force regenerates *that* file, preserving its
 * existing extension/format rather than switching it underneath the user — including
 * module syntax: a `.js` in a CommonJS project gets `module.exports`, and the
 * `defineConfig` variant is only emitted when svelte-vitals is actually a declared
 * dependency (its import must resolve at load time — npx-only projects would break).
 * Only a fresh scaffold (nothing exists yet) auto-picks the best extension for this
 * environment (see detectBestConfigExtension in config-file-format.ts).
 */
function planForConfigTarget(target: ConfigTarget, io: InstallIO, force: boolean, appDir: string): PlanRow {
  const existingRel = findExistingConfigFile(io.readFile, appDir);
  if (existingRel !== undefined) {
    const path = join(appDir, existingRel);
    const status: WriteStatus = force ? 'updated' : 'exists';
    const content = force
      ? buildConfigFileTemplate({
          useDefineConfig: existingRel.endsWith('.ts') && hasSvelteVitalsDependency(io.readFile, appDir),
          useCommonJs: existingRel.endsWith('.js') && !isEsmProject(io.readFile, appDir)
        })
      : undefined;
    return { id: target.id, label: target.label, path, status, content };
  }
  const ext = detectBestConfigExtension({
    readFile: io.readFile,
    cwd: appDir,
    nodeVersion: io.nodeVersion ?? process.version
  });
  const path = join(appDir, `svelte-vitals.config.${ext}`);
  const content = buildConfigFileTemplate({ useDefineConfig: ext === 'ts' });
  return { id: target.id, label: target.label, path, status: 'created', content };
}

/**
 * Plan the CI workflow scaffolder — the same writer `svelte-vitals ci install` uses
 * (planWorkflowWrite/buildWorkflowYaml), exposed as one more selectable target so it
 * doesn't require a separate command in the common case.
 */
function planForCiTarget(target: CiTarget, io: InstallIO, force: boolean): PlanRow {
  const path = join(io.cwd, target.relPath);
  const existing = io.readFile(path);
  const plan = planWorkflowWrite(existing, force);
  const content =
    plan.status === 'exists' ? undefined : buildWorkflowYaml({ actionSha: ACTION_SHA, actionVersion: ACTION_VERSION });
  return { id: target.id, label: target.label, path, status: plan.status, content };
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((l) => `      ${l}`)
    .join('\n');
}

function rowLine(r: PlanRow): string {
  const head = `  ${r.label} → ${r.path}  [${r.status}]`;
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
    const content = agentTargetContent(target.id, version);
    for (const relPath of target.relPaths) {
      const path = join(io.cwd, relPath);
      // readFile maps only ENOENT to undefined and rethrows everything else (EACCES, EISDIR, …),
      // so treat a per-path read failure like a per-path write failure: report it, keep
      // refreshing the other paths/targets, and exit 2 at the end.
      try {
        if (io.readFile(path) === undefined) continue;
        rows.push({ id: target.id, label: target.label, path, status: 'updated', content });
      } catch (err) {
        hadFailure = true;
        io.errorLog(`svelte-vitals: failed to read ${path}: ${err instanceof Error ? err.message : String(err)}`);
      }
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
    const viteConfigExists = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs'].some((f) =>
      configExists(join(io.cwd, f))
    );
    const claudeSkillDetected = configExists(join(io.cwd, '.claude', 'settings.json'));
    // Same shape as claudeSkillDetected: "this project uses Cursor", from a file Cursor
    // itself keeps — plus the rules file this target already wrote, so a re-run finds it
    // ticked. `.cursor/mcp.json` stays a signal: it never meant svelte-vitals' own server
    // entry, only that Cursor is in use here, and it still means exactly that. Each probe
    // has to name a file, not a directory — readFile maps only ENOENT to undefined and
    // rethrows EISDIR, so `.cursor/` itself would always read as absent.
    const cursorRulesDetected = [
      '.cursor/mcp.json',
      '.cursor/environment.json',
      '.cursorrules',
      '.cursorignore',
      agentTargetById('cursor-rules')!.relPaths[0]!
    ].some((rel) => configExists(join(io.cwd, rel)));
    const detectedAgents: AgentTargetId[] = [
      ...(claudeSkillDetected ? (['claude-skill'] as const) : []),
      ...(cursorRulesDetected ? (['cursor-rules'] as const) : [])
    ];
    const ciWorkflowDetected = configExists(join(io.cwd, CI_TARGETS[0]!.relPath));
    // configExists (not findExistingConfigFile directly) so a throwing readFile can't
    // crash detection — same tolerance as every other detection probe above.
    const configFileDetected = findExistingConfigFile((p) => (configExists(p) ? '' : undefined), io.cwd) !== undefined;
    const detected: TargetId[] = [
      ...(viteConfigExists ? VITE_TARGETS.map((t) => t.id) : []),
      ...detectedAgents,
      ...(ciWorkflowDetected ? CI_TARGETS.map((t) => t.id) : []),
      ...(configFileDetected ? CONFIG_TARGETS.map((t) => t.id) : [])
    ];
    // Grouped by category so the picker renders distinct sections instead of one flat
    // list — flattening all four target types together made it hard to tell what an id
    // was for (a Vite target vs. an agent skill vs. a one-off).
    const groups: Record<string, SelectableOption[]> = {
      'Vite integration': VITE_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint })),
      'Agent Skills & rules': AGENT_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint })),
      'CI (GitHub Actions)': CI_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint })),
      'Config file': CONFIG_TARGETS.map((t) => ({ id: t.id, label: t.label, hint: t.hint }))
    };
    const picked = await prompts.selectClients(groups, detected);
    if (picked === null) {
      io.log('Cancelled.');
      return 0;
    }
    ids = picked;
  } else {
    io.errorLog(
      'svelte-vitals: no TTY; pass --client <vite-plugin,vite-hooks,claude-skill,cursor-rules,claude-skill-improve,config-file,ci-workflow> to install non-interactively.'
    );
    return 2;
  }

  const viteIds = ids.filter(isViteTargetId);
  const agentIds = ids.filter(isAgentTargetId);
  const configIds = ids.filter(isConfigTargetId);
  const ciIds = ids.filter(isCiTargetId);
  if (viteIds.length === 0 && agentIds.length === 0 && configIds.length === 0 && ciIds.length === 0) {
    io.errorLog('svelte-vitals: no valid targets selected.');
    return 2;
  }

  // 2. Monorepo: resolve the app directory the app-scoped targets write into.
  // vite-plugin/vite-hooks/config-file must land in the SvelteKit app itself (that's
  // where vite.config/hooks.server live, and the config file is only loaded from the
  // analyzed directory) — everything else (skills, the CI workflow) belongs at the
  // repo root and ignores this. Mirrors the analyzer's own
  // app picker (design doc 2026-07-08-monorepo-app-picker-design.md): cwd-is-an-app
  // short-circuits, a single detected app is used with a notice, several prompt on a
  // TTY, and non-interactive runs get told to pass --app.
  // A directory counts as a SvelteKit app if it has svelte.config.{js,ts}, OR a
  // package.json declaring @sveltejs/kit — mirrors the analyzer's own detectProject
  // (design §17). The package.json signal matters because current `sv create` output
  // folds SvelteKit config into vite.config.ts and emits no separate svelte.config file.
  const isSvelteKitApp = (dir: string): boolean => {
    try {
      if (
        io.readFile(join(dir, 'svelte.config.js')) !== undefined ||
        io.readFile(join(dir, 'svelte.config.ts')) !== undefined
      ) {
        return true;
      }
      const pkgRaw = io.readFile(join(dir, 'package.json'));
      if (pkgRaw === undefined) return false;
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      return Boolean(pkg.dependencies?.['@sveltejs/kit'] ?? pkg.devDependencies?.['@sveltejs/kit']);
    } catch {
      return false;
    }
  };
  const needsApp = viteIds.length > 0 || configIds.length > 0;
  let appDir = io.cwd;
  if (needsApp) {
    if (flags.app) {
      const candidate = join(io.cwd, flags.app);
      if (!isSvelteKitApp(candidate)) {
        io.errorLog(
          `svelte-vitals: --app '${flags.app}' is not a SvelteKit app (no svelte.config.{js,ts} or @sveltejs/kit dependency there).`
        );
        return 2;
      }
      appDir = candidate;
    } else if (!isSvelteKitApp(io.cwd)) {
      const apps = await (io.discoverApps ?? discoverApps)(io.cwd);
      if (apps.length === 1) {
        io.errorLog(`svelte-vitals: detected SvelteKit app at ${apps[0]}; targeting it for the Vite/config targets.`);
        appDir = join(io.cwd, apps[0]!);
      } else if (apps.length > 1) {
        if (io.isTTY) {
          const picked = await prompts.selectApp(apps);
          if (picked === null) {
            io.log('Cancelled.');
            return 0;
          }
          appDir = join(io.cwd, picked);
        } else {
          io.errorLog(`svelte-vitals: multiple SvelteKit apps found: ${apps.join(', ')}.`);
          io.errorLog(`svelte-vitals: pass one with --app, e.g. \`svelte-vitals install --app ${apps[0]}\`.`);
          return 2;
        }
      }
      // 0 apps found → keep cwd, same as before this feature existed (install has
      // never hard-required a SvelteKit project).
    }
  }

  // 3. Build the plan.
  //
  // readFile maps only ENOENT to undefined and rethrows everything else (EACCES, EISDIR,
  // …), which must become a friendly exit 2 rather than an unhandled rejection — hence
  // the same try/catch on every target loop below.
  const rows: PlanRow[] = [];
  for (const viteId of viteIds) {
    try {
      rows.push(viteId === 'vite-plugin' ? planForVitePlugin(io, appDir) : planForViteHooks(io, appDir));
    } catch (err) {
      io.errorLog(
        `svelte-vitals: could not check existing Vite target ${viteId}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }
  for (const agentId of agentIds) {
    const target = agentTargetById(agentId)!;
    try {
      rows.push(...planForAgentTarget(target, io, flags.force ?? false, version));
    } catch (err) {
      io.errorLog(
        `svelte-vitals: could not check existing agent target ${target.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }
  for (const configId of configIds) {
    const target = configTargetById(configId)!;
    try {
      rows.push(planForConfigTarget(target, io, flags.force ?? false, appDir));
    } catch (err) {
      io.errorLog(
        `svelte-vitals: could not check existing config file: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }
  for (const ciId of ciIds) {
    const target = ciTargetById(ciId)!;
    try {
      rows.push(planForCiTarget(target, io, flags.force ?? false));
    } catch (err) {
      io.errorLog(
        `svelte-vitals: could not check existing workflow at ${join(io.cwd, target.relPath)}: ${err instanceof Error ? err.message : String(err)}`
      );
      return 2;
    }
  }

  // 4. Preview.
  const planText = rows.map(rowLine).join('\n');
  io.log('Plan:');
  io.log(planText);

  // 5. Dry-run / confirm.
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

  // 6. Write.
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
      // The .ts pick was validated against *this* machine's Node only — the committed
      // config also has to load wherever svelte-vitals runs next (CI, teammates), and
      // Node 22.13–22.17 can't load .ts without a flag.
      if (isConfigTargetId(r.id) && r.path.endsWith('.ts')) {
        io.log(
          'svelte-vitals: note — a .ts config needs Node 22.18+ (or 23.6+) everywhere svelte-vitals runs, CI included; rename to .mjs if that is not guaranteed.'
        );
      }
    } catch (err) {
      hadFailure = true;
      io.errorLog(`svelte-vitals: failed to write ${r.path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  // 7. Auto-install @svelte-vitals/vite if a Vite target was actually written —
  // run this even if another row failed, so a partial failure elsewhere doesn't
  // silently strand a freshly-registered vite.config without its dependency
  // (once written, the codemod reports 'exists' on every later run, so this is
  // the only chance to install it). In a monorepo, the dependency belongs to the
  // app's own package.json, so both the check and the install run in appDir; the
  // package manager is still detected from wherever the lockfile lives (the repo
  // root in a workspace setup — an app dir usually has none).
  const appIo = { ...io, cwd: appDir };
  if (viteWasWritten && io.runCommand && !hasVitePackage(appIo)) {
    const pm = appDir === io.cwd ? detectPackageManager(io) : detectPackageManagerNear(io, appDir);
    const { command, args } = installCommand(pm);
    io.log(`Installing @svelte-vitals/vite via ${pm}...`);
    const code = io.runCommand(command, args, appDir);
    if (code !== 0) {
      io.errorLog(
        `svelte-vitals: failed to install @svelte-vitals/vite (${command} ${args.join(' ')} exited ${code}). Install it manually.`
      );
    } else {
      const installedVersion = readInstalledViteVersion(appIo) ?? readInstalledViteVersion(io);
      io.log(
        installedVersion
          ? `svelte-vitals: installed @svelte-vitals/vite@${installedVersion} — compare against \`svelte-vitals --version\`'s core number if findings ever seem out of sync.`
          : 'svelte-vitals: installed @svelte-vitals/vite (could not read the installed version from node_modules).'
      );
    }
  }

  if (hadFailure) return 2;

  io.log('');
  if (agentIds.length > 0) io.log('Restart your agent (or start a new session) to pick up the generated skill.');
  if (viteWasWritten) io.log('Restart `vite dev` (or your build) to pick up the change.');
  io.log('Done.');
  return 0;
}
