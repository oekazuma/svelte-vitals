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
