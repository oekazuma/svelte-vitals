import { execFileSync } from 'node:child_process';
import { type Config, type Result } from '@svelte-vitals/core';
import { defaultConfig, isPenalized } from '@svelte-vitals/core/internal';

interface ChangedFilesOptions {
  /** Report only files staged for commit (`git diff --cached`). */
  staged?: boolean;
  /** Compare the working tree against the merge-base with this ref (default 'HEAD'). Ignored when `staged`. */
  base?: string;
}

/** `-z` is required: default `core.quotePath` octal-escapes non-ASCII paths, which would never match `Result.location`. */
function git(args: string[], cwd: string): string[] {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0');
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
      ? git(['diff', '--name-only', '--relative', '--cached', '--diff-filter=d', '-z'], cwd)
      : [
          ...git(
            ['diff', '--name-only', '--relative', '--diff-filter=d', '--merge-base', opts.base ?? 'HEAD', '-z'],
            cwd
          ),
          ...git(['ls-files', '--others', '--exclude-standard', '-z'], cwd) // untracked / new files
        ];
    return new Set(files.filter(Boolean));
  } catch {
    return undefined;
  }
}

/**
 * Keep only findings located in a changed file, and (among those) only ones a `--diff`
 * gate should count: a penalized finding, or a route-less PASS. Results without a
 * `location` at all (project-scoped findings) are always dropped — the gate reports
 * issues *in* the changed files.
 *
 * A route-CARRYING PASS is dropped even when located in the changed set (design
 * 2026-08-08-pass-result-location-design.md): every PASS result now carries the same
 * `location` its penalized counterpart would, so without this gate a single incidental
 * passing check on a changed file would promote its whole category from *absent* to a
 * fabricated 100 in the `--diff`-scoped score, inflating Health in a way the gate's
 * "did this change introduce a problem" purpose forbids.
 *
 * A route-LESS PASS is the one exception, kept regardless of `isPenalized`: it is
 * `architecture/unit-entry-file`'s per-declaration pass seed (PR #337), which deliberately
 * carries `location` (the entry file) but no `route` specifically so a conforming unit's
 * pass stays visible when its entry file changes under `--diff`. This preserves a pre-existing
 * tradeoff, not a new one — `main`'s filter already kept this PASS unconditionally, so it
 * already promoted `architecture` to a fabricated 100 in `--diff` Health for a changed
 * conforming unit before this release, same as it does after. See "The
 * architecture/unit-entry-file exception" in
 * docs/superpowers/specs/2026-08-08-pass-result-location-design.md for the full mechanism
 * and why that promotion is real (measured: 79 → 89), not the score-inert claim an earlier
 * version of this comment made.
 *
 * `config` defaults for callers with none in hand (`ApplyScopeOptions.config` is optional,
 * mirroring `filterToNewFindings` in baseline.ts).
 */
export function filterToChangedFiles(
  results: Result[],
  changed: Set<string>,
  config: Config = defaultConfig
): Result[] {
  return results.filter(
    (r) =>
      r.location !== undefined &&
      changed.has(r.location) &&
      (isPenalized(r.detection, config.treatDynamicAs) || r.route === undefined)
  );
}
