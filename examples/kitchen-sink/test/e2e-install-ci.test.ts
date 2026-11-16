import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const appDir = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const bin = join(appDir, '..', '..', 'packages', 'cli', 'dist', 'bin.js');
const workflowRel = join('.github', 'workflows', 'svelte-vitals.yml');

const dirs: string[] = [];
const fresh = () => {
  // realpath: tmpdir() is a symlink on macOS, which would skew the relative path to appDir.
  const d = realpathSync(mkdtempSync(join(tmpdir(), 'svelte-vitals-install-ci-')));
  dirs.push(d);
  return d;
};

// Fully explicit env: this repository's own CI sets the GITHUB_* variables, which must not leak in.
function install(cwd: string, app: string) {
  const r = spawnSync(process.execPath, [bin, 'install', '--client', 'ci-workflow', '--app', app], {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' }
  });
  return { status: r.status, stderr: r.stderr };
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('kitchen-sink e2e (install --client ci-workflow --app)', () => {
  it('writes the app directory as the run step positional argument', () => {
    const cwd = fresh();
    const r = install(cwd, relative(cwd, appDir));
    expect(r.status, r.stderr).toBe(0);
    const yaml = readFileSync(join(cwd, workflowRel), 'utf8');
    expect(yaml).toMatch(/'[^']*examples\/kitchen-sink' --reporter github/);
  });

  it('exits 2 and writes no workflow when --app is not a SvelteKit app', () => {
    const cwd = fresh();
    const r = install(cwd, relative(cwd, fresh()));
    expect(r.status, r.stderr).toBe(2);
    expect(existsSync(join(cwd, workflowRel))).toBe(false);
  });
});
