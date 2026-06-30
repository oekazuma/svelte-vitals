import { execFileSync } from 'node:child_process';
import type { Result } from '@svelte-vitals/core';

export interface ChangedFilesOptions {
  /** Report only files staged for commit (`git diff --cached`). */
  staged?: boolean;
  /** Compare the working tree against this ref (default 'HEAD'). Ignored when `staged`. */
  base?: string;
}

/**
 * Repo-relative POSIX paths changed per the options, or `undefined` when git can't
 * answer (not a repo, git missing, bad ref). Deleted files are excluded — there is
 * nothing left to analyze. Used to scope `--diff` / `--staged` runs.
 */
export function getChangedFiles(cwd: string, opts: ChangedFilesOptions): Set<string> | undefined {
  const args = opts.staged
    ? ['diff', '--name-only', '--cached', '--diff-filter=d']
    : ['diff', '--name-only', '--diff-filter=d', opts.base ?? 'HEAD'];
  try {
    const out = execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return new Set(
      out
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } catch {
    return undefined;
  }
}

/**
 * Keep only findings located in a changed file. Results without a `location`
 * (project-scoped findings, passing seeds) are dropped — the gate reports issues
 * *in* the changed files.
 */
export function filterToChangedFiles(results: Result[], changed: Set<string>): Result[] {
  return results.filter((r) => r.location !== undefined && changed.has(r.location));
}
