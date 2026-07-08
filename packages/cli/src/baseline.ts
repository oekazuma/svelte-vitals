import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Result } from '@svelte-vitals/core';

function git(args: string[], cwd: string): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

/** finding の同一性キー。line は含めない — 無関係な行ズレで「新規」誤検出しないため。 */
export function findingKey(r: Result): string {
  return `${r.id}::${r.route ?? ''}::${r.location ?? ''}`;
}

/**
 * `ref` 時点のプロジェクトを一時 git worktree に展開し、そのパス(解析すべき cwd)を返す。
 * 返り値 undefined = git が答えられない(repo 外 / ref 不在 / git 不在)。
 * 呼び出し側は必ず cleanup コールバックを finally で呼ぶこと。
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

/** 現在の results から、baseline に存在した finding(同一キー)を取り除く。 */
export function filterToNewFindings(results: Result[], baselineResults: Result[]): Result[] {
  const baselineKeys = new Set(baselineResults.map(findingKey));
  return results.filter((r) => !baselineKeys.has(findingKey(r)));
}
