import { execFileSync } from 'node:child_process';
import type { Result } from '@svelte-vitals/core';

interface ChangedFilesOptions {
  /** Report only files staged for commit (`git diff --cached`). */
  staged?: boolean;
  /** Compare the working tree against the merge-base with this ref (default 'HEAD'). Ignored when `staged`. */
  base?: string;
}

function git(args: string[], cwd: string): string[] {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n');
}

/**
 * `cwd`-relative POSIX paths changed per the options, or `undefined` when git can't
 * answer (not a repo, git missing, bad ref). Deleted files are excluded — there is
 * nothing left to analyze. Used to scope `--diff` / `--staged` runs.
 *
 * Paths are resolved relative to `cwd` (via `--relative`), matching the basis of
 * `Result.location` — this matters when the analyzed project lives in a subdirectory
 * of the git repo (e.g. a monorepo's `apps/web/`), since `git diff --name-only` on
 * its own reports repo-root-relative paths. `git ls-files --others` is already
 * `cwd`-relative and scoped to `cwd`, so it needs no such flag.
 *
 * For `--diff`, the working tree is compared against the **merge-base** with `base`
 * (so `--diff main` is "what this branch changed", not files that only moved on
 * `main`), and untracked (new) files are unioned in — a "gate what changed" run
 * must catch brand-new components too.
 */
export function getChangedFiles(cwd: string, opts: ChangedFilesOptions): Set<string> | undefined {
  try {
    const files = opts.staged
      ? git(['diff', '--name-only', '--relative', '--cached', '--diff-filter=d'], cwd)
      : [
          ...git(['diff', '--name-only', '--relative', '--diff-filter=d', '--merge-base', opts.base ?? 'HEAD'], cwd),
          ...git(['ls-files', '--others', '--exclude-standard'], cwd) // untracked / new files
        ];
    return new Set(files.map((s) => s.trim()).filter(Boolean));
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
