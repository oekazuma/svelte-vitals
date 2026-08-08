import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig, isPenalized, type Config, type Result } from '@svelte-vitals/core';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/**
 * Identity key for a finding. `line` is deliberately excluded — unrelated line
 * drift must not make an existing finding look "new". The parameter is a `Pick`
 * so that suppressions.ts (packages/cli/src/suppressions.ts) can reuse this
 * exact key function on `SuppressionEntry` values (which carry only
 * `id`/`route`/`location`, not a full `Result`) instead of duplicating the
 * key template.
 */
export function findingKey(r: Pick<Result, 'id' | 'route' | 'location'>): string {
  return `${r.id}::${r.route ?? ''}::${r.location ?? ''}`;
}

/**
 * Expands the project as of `ref` into a temporary git worktree and returns its path
 * (the cwd to analyze). Returns undefined when git can't answer — outside a repo, the
 * ref doesn't exist, or git isn't installed. Callers must always invoke the cleanup
 * callback in a `finally` block.
 */
export function checkoutBaseline(cwd: string, ref: string): { analyzeCwd: string; cleanup: () => void } | undefined {
  let tmp: string | undefined;
  try {
    const repoRoot = git(['rev-parse', '--show-toplevel'], cwd).trim();
    // `--show-prefix` ends with a trailing slash (e.g. 'apps/web/') when cwd is a
    // subdirectory, and `join()` preserves that trailing separator — strip it so
    // analyzeCwd is a normalized directory path either way.
    const showPrefix = git(['rev-parse', '--show-prefix'], cwd).trim().replace(/\/+$/, '');

    tmp = mkdtempSync(join(tmpdir(), 'svelte-vitals-baseline-'));
    const wt = join(tmp, 'wt');
    git(['worktree', 'add', '--detach', wt, ref], repoRoot);

    const analyzeCwd = showPrefix ? join(wt, showPrefix) : wt;
    const tmpDir = tmp;
    const cleanup = (): void => {
      try {
        execFileSync('git', ['worktree', 'remove', '--force', wt], {
          cwd: repoRoot,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        });
      } catch {
        try {
          execFileSync('git', ['worktree', 'prune'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
          });
        } catch {
          // best-effort; fall through to rmSync below regardless.
        }
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    };

    return { analyzeCwd, cleanup };
  } catch {
    if (tmp !== undefined) rmSync(tmp, { recursive: true, force: true });
    return undefined;
  }
}

/**
 * Removes findings from the current `results` that already existed in the baseline (same key).
 * Both sides are filtered to penalized findings before keying, so a PASS result can never key-collide
 * with a PENALIZED one (docs/superpowers/specs/2026-08-08-pass-result-location-design.md, "Sequencing").
 * `config` defaults for callers with none in hand (`ApplyScopeOptions.config` is optional).
 */
export function filterToNewFindings(
  results: Result[],
  baselineResults: Result[],
  config: Config = defaultConfig
): Result[] {
  const penalized = (rs: Result[]) => rs.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
  const baselineKeys = new Set(penalized(baselineResults).map(findingKey));
  return penalized(results).filter((r) => !baselineKeys.has(findingKey(r)));
}
