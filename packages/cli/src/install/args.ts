import type mri from 'mri';
import { CLIENTS, type Scope } from './clients.js';
import { VITE_TARGETS } from './vite-targets.js';
import type { InstallFlags, TargetId } from './index.js';

const VALID_TARGETS: readonly TargetId[] = [...CLIENTS.map((c) => c.id), ...VITE_TARGETS.map((t) => t.id)];

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
      warnings.push(
        `svelte-vitals: unknown --client '${c}'; expected claude-code|cursor|codex|vite-plugin|vite-dev-overlay. Skipping.`
      );
    }
  }
  if (rawClients.length > 0 && client.length === 0) {
    errors.push(
      'svelte-vitals: no valid --client values; expected claude-code|cursor|codex|vite-plugin|vite-dev-overlay.'
    );
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
