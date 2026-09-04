import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as p from '@clack/prompts';
import { terminalSafe } from '@svelte-vitals/core/internal';
import type { InstallIO, InstallPrompts, SelectableOption, TargetId } from './index.js';

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
    // clack reads from stdin and renders to stdout, so both must be interactive —
    // a piped/redirected stdin would leave the prompt hanging for input that never comes.
    isTTY: Boolean(process.stdin.isTTY) && Boolean(process.stdout.isTTY),
    log: (line) => console.log(terminalSafe(line)),
    errorLog: (line) => console.error(terminalSafe(line)),
    runCommand: (command, args, cwd) => {
      const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: process.platform === 'win32',
        timeout: 120_000
      });
      if (result.error) {
        console.error(terminalSafe(`svelte-vitals: ${command} failed to start: ${result.error.message}`));
        return 1;
      }
      if (result.signal) {
        console.error(
          terminalSafe(`svelte-vitals: ${command} was terminated (${result.signal}) — it may have timed out.`)
        );
        return 1;
      }
      return result.status ?? 1;
    }
  };
}

/** Single-select app picker via @clack/prompts — shared with bin.ts's monorepo analyzer picker. Returns null when cancelled. */
export async function selectAppPrompt(apps: string[], message: string): Promise<string | null> {
  const res = await p.select({
    message,
    // `apps` are directory names straight off the filesystem: sanitize what clack renders, never
    // the `value` — that is the path the caller goes on to use.
    options: apps.map((a) => ({ value: a, label: terminalSafe(a) })),
    initialValue: apps[0]
  });
  return p.isCancel(res) ? null : (res as string);
}

/** Exported: shared with the gunshi/bone port (src/gunshi/install.ts), the only remaining caller. */
export function clackPrompts(): InstallPrompts {
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
    selectApp: (apps: string[]) =>
      selectAppPrompt(apps, 'Multiple SvelteKit apps found — which one should the Vite/config targets go into?'),
    confirm: async (planText: string) => {
      // planText carries analyzed-repo paths and manual-row snippets; same boundary as log/errorLog above.
      const res = await p.confirm({ message: `Apply this plan?\n${terminalSafe(planText)}` });
      return p.isCancel(res) ? false : Boolean(res);
    }
  };
}
