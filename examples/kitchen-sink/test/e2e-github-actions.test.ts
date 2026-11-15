import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(appDir, '..', '..');
const bin = join(repoRoot, 'packages', 'cli', 'dist', 'bin.js');

// Fully explicit env: this repository's own CI sets the GITHUB_* variables, which must not leak in.
function run(extra: Record<string, string>) {
  const r = spawnSync(process.execPath, [bin, appDir, '--reporter', 'github'], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', ...extra },
    maxBuffer: 64 * 1024 * 1024
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const files = (stdout: string) => [...stdout.matchAll(/file=([^,]+),/g)].map((m) => m[1]);

let tmp: string;
let summary: string;
let plain: ReturnType<typeof run>;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'svelte-vitals-gha-'));
  summary = join(tmp, 'summary.md');
  writeFileSync(summary, '');
  plain = run({});
}, 120_000);

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('kitchen-sink e2e (GitHub Actions)', () => {
  it('plain run has no project-path prefix', () => {
    expect(plain.status).not.toBe(2);
    expect(files(plain.stdout).length).toBeGreaterThan(0);
    expect(files(plain.stdout).some((f) => f.startsWith('examples/kitchen-sink/'))).toBe(false);
  });

  describe('under GitHub Actions', () => {
    let r: ReturnType<typeof run>;
    beforeAll(() => {
      r = run({ GITHUB_ACTIONS: 'true', GITHUB_WORKSPACE: repoRoot, GITHUB_STEP_SUMMARY: summary });
    }, 120_000);

    it('appends the markdown report to the job summary', () => {
      expect(readFileSync(summary, 'utf8')).toContain('| Category | Score |');
    });

    it('prefixes every annotation path with the project path', () => {
      const f = files(r.stdout);
      expect(f.length).toBeGreaterThan(0);
      expect(f.every((p) => p.startsWith('examples/kitchen-sink/'))).toBe(true);
    });

    it('exits like the plain run', () => {
      expect(r.status).toBe(plain.status);
    });
  });

  describe('as the retired action', () => {
    it('leaves summary and paths to the action and prints the retirement notice', () => {
      const retiredSummary = join(tmp, 'retired.md');
      writeFileSync(retiredSummary, '');
      const r = run({
        GITHUB_ACTIONS: 'true',
        GITHUB_ACTION_REPOSITORY: 'oekazuma/svelte-vitals-action',
        GITHUB_WORKSPACE: repoRoot,
        GITHUB_STEP_SUMMARY: retiredSummary
      });
      expect(readFileSync(retiredSummary, 'utf8')).toBe('');
      expect(files(r.stdout).length).toBeGreaterThan(0);
      expect(files(r.stdout).some((p) => p.startsWith('examples/kitchen-sink/'))).toBe(false);
      expect(r.stderr).toContain(
        'svelte-vitals: oekazuma/svelte-vitals-action is retired. Run `npx svelte-vitals@latest ci install --force` to switch this workflow to the CLI.'
      );
    }, 120_000);
  });
});
