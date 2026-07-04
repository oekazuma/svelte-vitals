import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import mri from 'mri';
import * as p from '@clack/prompts';
import { runInstall, type InstallIO, type InstallPrompts } from './index.js';
import { resolveInstallArgs } from './args.js';
import type { ClientWriter, Scope } from './clients.js';
import type { SelectableOption, TargetId } from './index.js';

const INSTALL_HELP = `svelte-vitals install — set up the svelte-vitals MCP server for your AI-agent clients

Usage:
  svelte-vitals install [options]

Options:
  --client <ids>    Comma-separated: claude-code,cursor,codex,vite-plugin,vite-dev-overlay (skips the interactive picker)
                    vite-plugin registers the build-mode plugin in vite.config; vite-dev-overlay
                    wires up the dev-overlay hook in src/hooks.server.ts. --force does not apply
                    to either — an existing registration is always left as-is.
  --scope <scope>   project | global (applies to all selected clients; codex is always global)
  --yes, -y         Skip the confirmation prompt
  --dry-run         Print the planned changes and exit without writing
  --force           Overwrite an existing svelte-vitals entry
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
      const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
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
