import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import mri from 'mri';
import * as p from '@clack/prompts';
import { runInstall, type InstallIO, type InstallPrompts } from './index.js';
import { resolveInstallArgs } from './args.js';
import { readPackageVersion } from '../version.js';
import type { ClientWriter, Scope } from './clients.js';
import type { SelectableOption, TargetId } from './index.js';

const INSTALL_HELP = `svelte-vitals install — set up the svelte-vitals MCP server, Vite integration, and agent skills/rules

Usage:
  svelte-vitals install [options]

Options:
  --client <ids>    Comma-separated: claude-code,cursor,codex,vite-plugin,vite-hooks,claude-skill,cursor-rules,claude-skill-improve,config-file
                    (skips the interactive picker)
                    vite-plugin registers the build-mode plugin in vite.config.{ts,js,mjs}; vite-hooks
                    wires up the svelteVitalsHandle hook in src/hooks.server.{ts,js}, which improves the
                    live dashboard's per-route accuracy as you browse. --force does not apply
                    to either of these two — an existing registration is always left as-is.
                    claude-skill writes an agent skill (Claude Code, Codex, and Cursor —
                    .claude/skills/, .agents/skills/, and .cursor/skills/ under svelte-vitals/);
                    cursor-rules writes a Cursor rules file (.cursor/rules/svelte-vitals.mdc).
                    Both are generated from the current rule set and support --force to regenerate.
                    claude-skill-improve writes a second, read-only agent skill (same three
                    locations, under improve-svelte/) that audits the whole project and writes
                    implementation plans instead of a run-after-every-edit playbook; also
                    supports --force.
                    config-file scaffolds svelte-vitals.config.mjs with every option commented out;
                    supports --force to regenerate.
  --scope <scope>   project | global (applies to all selected clients; codex is always global)
  --yes, -y         Skip the confirmation prompt
  --dry-run         Print the planned changes and exit without writing
  --force           Overwrite an existing svelte-vitals entry
  --refresh         Regenerate existing agent skill/rules files with the current rule set
                    (claude-skill / cursor-rules / claude-skill-improve). Only regenerates files already
                    present on disk — it never creates one. Cannot be combined with --client.
  -h, --help        Show this help`;

export function realIO(): InstallIO {
  return {
    readFile: (path) => {
      try {
        return readFileSync(path, 'utf8');
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw err;
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
    errorLog: (line) => console.error(line),
    runCommand: (command, args, cwd) => {
      const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        timeout: 120_000
      });
      if (result.error) {
        console.error(`svelte-vitals: ${command} failed to start: ${result.error.message}`);
        return 1;
      }
      if (result.signal) {
        console.error(`svelte-vitals: ${command} was terminated (${result.signal}) — it may have timed out.`);
        return 1;
      }
      return result.status ?? 1;
    }
  };
}

function clackPrompts(): InstallPrompts {
  return {
    selectClients: async (all: SelectableOption[], defaults: TargetId[]) => {
      const res = await p.multiselect({
        message: 'Which clients/targets should svelte-vitals be installed for?',
        options: all.map((o) => ({ value: o.id, label: o.label, hint: o.hint })),
        initialValues: defaults,
        required: true
      });
      return p.isCancel(res) ? null : (res as TargetId[]);
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
    boolean: ['yes', 'dry-run', 'force', 'refresh', 'help'],
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
  return runInstall(flags, realIO(), clackPrompts(), readPackageVersion());
}
