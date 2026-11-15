import { join } from 'node:path';
import { RETIRED_ACTION } from '../github-actions.js';
import { hasDep, parsePkg, type PkgJson } from '../pkg-json.js';
import { WORKFLOW_PATH } from './workflow.js';

/** The first release whose github reporter writes the job summary and repository-relative paths itself. */
export const WORKFLOW_MIN_CLI_VERSION = '0.57.0';

interface ReadIO {
  cwd: string;
  readFile(path: string): string | undefined;
}

export type WorkspacePkg = (PkgJson & { workspaces?: unknown }) | undefined;

export function isWorkspaceRoot(io: ReadIO, pkg: WorkspacePkg): boolean {
  return pkg?.workspaces !== undefined || io.readFile(join(io.cwd, 'pnpm-workspace.yaml')) !== undefined;
}

// Same rule as the retired action's minimum-version check, so a prerelease of the minimum passes.
function isAtLeast(version: string, min: string): boolean {
  const parse = (v: string) => (v.split('-')[0] ?? '').split('.').map(Number);
  const a = parse(version);
  const b = parse(min);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

/**
 * `existing` is the workflow file when it is left in place (no --force), undefined when it is
 * written. The other notes describe the generated run step, so they only apply to a written file.
 */
export function workflowNotes(io: ReadIO, existing: string | undefined, appPath?: string): string[] {
  if (existing !== undefined) {
    return existing.includes(RETIRED_ACTION)
      ? [
          `! ${WORKFLOW_PATH} still calls ${RETIRED_ACTION}, which is retired. Re-run with --force to replace it with the CLI step.`
        ]
      : [];
  }
  const notes: string[] = [];
  const pkg = parsePkg(io.readFile(join(io.cwd, 'package.json'))) as WorkspacePkg;
  if (appPath === undefined && isWorkspaceRoot(io, pkg) && !hasDep(pkg, 'svelte-vitals')) {
    notes.push(
      '! This is a workspace root. The svelte-vitals step runs ./node_modules/.bin/svelte-vitals here; if svelte-vitals is declared in an app instead, add working-directory: <app> to that step.'
    );
  }
  const installed = (
    parsePkg(io.readFile(join(io.cwd, 'node_modules/svelte-vitals/package.json'))) as { version?: unknown } | undefined
  )?.version;
  if (typeof installed === 'string' && !isAtLeast(installed, WORKFLOW_MIN_CLI_VERSION)) {
    notes.push(
      `! node_modules has svelte-vitals ${installed}. The workflow needs ${WORKFLOW_MIN_CLI_VERSION} or newer for the job summary and repository-relative annotations; update the devDependency.`
    );
  }
  return notes;
}
