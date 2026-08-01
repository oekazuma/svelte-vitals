import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import mri from 'mri';
import * as p from '@clack/prompts';
import { runInstall, type InstallIO, type InstallPrompts } from './index.js';
import { resolveInstallArgs } from './args.js';
import { readPackageVersion } from '../version.js';
import type { SelectableOption, TargetId } from './index.js';

const INSTALL_HELP = `svelte-vitals install — set up the svelte-vitals Vite integration, agent skills/rules, config file, and CI

Usage:
  svelte-vitals install [options]

Options:
  --client <ids>    Comma-separated: vite-plugin,vite-hooks,claude-skill,cursor-rules,claude-skill-improve,config-file,ci-workflow
                    (skips the interactive picker; the picker groups these by category —
                    Vite integration, Agent Skills & rules, CI, Config file)
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
                    config-file scaffolds svelte-vitals.config.{mjs,ts} with every option commented
                    out, auto-picking .ts (with defineConfig) when the current Node supports it, the
                    project looks TypeScript-oriented (tsconfig.json or vite.config.ts present), and
                    svelte-vitals is a declared dependency (defineConfig's import resolves at load
                    time); else the safe .mjs default. Supports --force to regenerate the file
                    that's already there (its extension never changes on --force).
                    ci-workflow scaffolds .github/workflows/svelte-vitals.yml, the same file
                    \`svelte-vitals ci install\` writes standalone — pick it here to set it up in
                    the same pass as everything else; supports --force to regenerate. \`svelte-vitals
                    ci upgrade\` remains the way to bump an existing workflow's pinned action version.
  --app <dir>       Monorepo: the SvelteKit app directory the vite-plugin/vite-hooks/config-file
                    targets write into (e.g. --app apps/web). Without it, when the current
                    directory isn't itself a SvelteKit app, one detected app is used
                    automatically (with a notice), several prompt a picker on a TTY, and
                    non-interactive runs exit 2 asking for --app. All other targets
                    (skills, ci-workflow) always write at the current directory —
                    the repo root is their correct home.
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
    nodeVersion: process.version,
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
    selectClients: async (groups: Record<string, SelectableOption[]>, defaults: TargetId[]) => {
      const res = await p.groupMultiselect({
        message: 'Which clients/targets should svelte-vitals be installed for?',
        options: Object.fromEntries(
          Object.entries(groups).map(([group, opts]) => [
            group,
            opts.map((o) => ({ value: o.id, label: o.label, hint: o.hint }))
          ])
        ),
        initialValues: defaults,
        required: true
      });
      return p.isCancel(res) ? null : (res as TargetId[]);
    },
    selectApp: async (apps: string[]) => {
      const res = await p.select({
        message: 'Multiple SvelteKit apps found — which one should the Vite/config targets go into?',
        options: apps.map((a) => ({ value: a, label: a })),
        initialValue: apps[0]
      });
      return p.isCancel(res) ? null : (res as string);
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
    // `scope` is still declared although the flag is gone: it keeps `--scope global` from
    // parsing its value as a positional, so resolveInstallArgs can warn and carry on.
    string: ['client', 'scope', 'app'],
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
