import { execSync } from 'node:child_process';

/**
 * Resolve the commit SHA to pin the GitHub Action to. Prefers HEAD, but
 * falls back to the nearest ancestor already on `origin/main` when HEAD
 * itself isn't pushed there yet — a local dev build (e.g. testing
 * `ci install` against a `pnpm link`ed checkout with unpushed commits)
 * must never bake in a SHA that GitHub can't resolve on the real remote.
 *
 * `run` is injectable for testing: `(command: string) => string`, trimmed
 * stdout, throwing on a non-zero exit. Defaults to shelling out via
 * `execSync` against `cwd`.
 */
export function resolveActionSha(cwd, run = defaultRun(cwd)) {
  const head = run('git rev-parse HEAD');
  if (isAncestorOfOriginMain(head, run)) {
    return head; // HEAD is already on origin/main — the common release case.
  }
  try {
    return run('git merge-base HEAD origin/main');
  } catch {
    return head; // no origin/main info available (e.g. no remote) — best effort.
  }
}

function isAncestorOfOriginMain(sha, run) {
  try {
    run(`git merge-base --is-ancestor ${sha} origin/main`);
    return true;
  } catch {
    return false;
  }
}

function defaultRun(cwd) {
  return (command) => execSync(command, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}
