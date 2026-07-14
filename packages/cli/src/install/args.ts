import type mri from 'mri';
import { CLIENTS, type Scope } from './clients.js';
import { VITE_TARGETS } from './vite-targets.js';
import { AGENT_TARGETS } from './agent-targets.js';
import { CONFIG_TARGETS } from './config-targets.js';
import type { InstallFlags, TargetId } from './index.js';

const VALID_TARGETS: readonly TargetId[] = [
  ...CLIENTS.map((c) => c.id),
  ...VITE_TARGETS.map((t) => t.id),
  ...AGENT_TARGETS.map((t) => t.id),
  ...CONFIG_TARGETS.map((t) => t.id)
];
const EXPECTED_TARGETS = VALID_TARGETS.join('|');

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
  const client: TargetId[] = [];
  for (const c of rawClients) {
    if ((VALID_TARGETS as readonly string[]).includes(c)) {
      if (!client.includes(c as TargetId)) client.push(c as TargetId);
    } else {
      warnings.push(`svelte-vitals: unknown --client '${c}'; expected ${EXPECTED_TARGETS}. Skipping.`);
    }
  }
  if (rawClients.length > 0 && client.length === 0) {
    errors.push(`svelte-vitals: no valid --client values; expected ${EXPECTED_TARGETS}.`);
  }

  let scope: Scope | undefined;
  const rawScope = argv.scope;
  if (typeof rawScope === 'string') {
    if (rawScope === 'project' || rawScope === 'global') scope = rawScope;
    else errors.push(`svelte-vitals: unknown --scope '${rawScope}'; expected project|global.`);
  }

  const refresh = Boolean(argv.refresh);
  if (refresh && rawClients.length > 0) {
    errors.push('svelte-vitals: --refresh regenerates existing files and cannot be combined with --client.');
  }

  if (errors.length > 0) return { flags: null, warnings, errors };

  if (refresh && (scope !== undefined || Boolean(argv.yes) || Boolean(argv.force))) {
    warnings.push('svelte-vitals: --scope, --yes, and --force are ignored with --refresh.');
  }

  return {
    flags: {
      ...(client.length > 0 ? { client } : {}),
      ...(scope ? { scope } : {}),
      yes: Boolean(argv.yes),
      dryRun: Boolean(argv['dry-run']),
      force: Boolean(argv.force),
      ...(refresh ? { refresh: true } : {})
    },
    warnings,
    errors
  };
}
