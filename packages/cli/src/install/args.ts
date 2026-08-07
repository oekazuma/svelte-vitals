import { parseCliArgs, toList, type CliArgv } from '../cli-args.js';
import { INSTALL_TARGETS, type TargetId } from './targets.js';
import type { InstallFlags } from './index.js';

const VALID_TARGETS: readonly TargetId[] = INSTALL_TARGETS.map((t) => t.id);
const EXPECTED_TARGETS = VALID_TARGETS.join('|');

/** Parse `install`'s argv, exactly as `runInstallCli` does — exported so tests share the real flag table. */
export function parseInstallArgs(args: string[]): CliArgv {
  return parseCliArgs(args, {
    boolean: ['yes', 'dry-run', 'force', 'refresh', 'help'],
    // `scope` is still declared although the flag is gone: it keeps `--scope global` from
    // parsing its value as a positional, so resolveInstallArgs can warn and carry on.
    string: ['client', 'scope', 'app'],
    short: { y: 'yes', h: 'help' }
  });
}

interface ResolvedInstallArgs {
  /** Flags to pass to runInstall, or null when a fatal (exit-2) error was found. */
  flags: InstallFlags | null;
  warnings: string[];
  errors: string[];
}

export function resolveInstallArgs(argv: CliArgv): ResolvedInstallArgs {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rawClients = toList(argv.client);
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

  // --scope existed only to choose between a project and a global MCP client config.
  // With the MCP targets gone every remaining target writes into the project, so the
  // flag has nothing left to select — warn rather than fail, so an upgraded script
  // still installs instead of exiting 2 on a flag that is merely obsolete.
  if (argv.scope !== undefined) {
    warnings.push('svelte-vitals: --scope is no longer used (all install targets are project-scoped). Ignoring.');
  }

  const app = typeof argv.app === 'string' && argv.app.trim() !== '' ? argv.app.trim() : undefined;

  const refresh = Boolean(argv.refresh);
  if (refresh && rawClients.length > 0) {
    errors.push('svelte-vitals: --refresh regenerates existing files and cannot be combined with --client.');
  }

  if (errors.length > 0) return { flags: null, warnings, errors };

  if (refresh && (Boolean(argv.yes) || Boolean(argv.force) || app !== undefined)) {
    warnings.push('svelte-vitals: --yes, --force, and --app are ignored with --refresh.');
  }

  return {
    flags: {
      ...(client.length > 0 ? { client } : {}),
      ...(app !== undefined && !refresh ? { app } : {}),
      yes: Boolean(argv.yes),
      dryRun: Boolean(argv['dry-run']),
      force: Boolean(argv.force),
      ...(refresh ? { refresh: true } : {})
    },
    warnings,
    errors
  };
}
