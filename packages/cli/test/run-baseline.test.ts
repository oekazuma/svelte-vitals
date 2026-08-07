import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Mock the baseline git layer so run()'s --baseline gating is testable without a real
// worktree checkout, following run-diff.test.ts's pattern for the analogous --diff layer.
vi.mock('../src/baseline.js', async (orig) => {
  const actual = await orig<typeof import('../src/baseline.js')>();
  return { ...actual, checkoutBaseline: vi.fn() };
});
vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});

import { run } from '../src/index.js';
import { checkoutBaseline } from '../src/baseline.js';
import { getChangedFiles } from '../src/changed-files.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const configFileFixtureDir = join(here, 'fixtures', 'config-file-project');
const CLEAN_ENV: NodeJS.ProcessEnv = {};
const mockCheckout = vi.mocked(checkoutBaseline);
const mockGet = vi.mocked(getChangedFiles);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (l: string) => out.push(l), errorLog: (l: string) => err.push(l) };
}

describe('run() --baseline gating', () => {
  beforeEach(() => {
    mockCheckout.mockReset();
    mockGet.mockReset();
  });

  it('removes findings that were already present at the baseline ref', async () => {
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    // Baseline == current project, so every current finding is "already present" -> removed.
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(code).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('warns and reports all findings when checkoutBaseline cannot answer', async () => {
    mockCheckout.mockReturnValue(undefined);
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(cap.err.join('\n')).toContain("could not analyze baseline 'origin/main'");
    expect(cap.out.join('\n')).toContain('seo/title-presence');
    expect(code).toBe(1);
  });

  it('analyzes the baseline under the same rule selection, so a force-enabled finding is not new', async () => {
    // `config-file-project` sets `seo/title-presence: 'off'`, so the rule only produces its
    // finding because --rules force-enables it. A baseline analyzed without that selection keeps
    // the file's `'off'`, finds nothing, and every pre-existing finding is reported as new.
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: configFileFixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: configFileFixtureDir,
      baseline: 'origin/main',
      allowRules: ['seo/title-presence'],
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(code).toBe(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('applies --diff and --baseline together, in order (--diff narrows first, --baseline narrows further)', async () => {
    // --diff keeps only the blog route's finding(s); --baseline (mocked against the
    // same project) then removes everything, since the "baseline" == current findings.
    mockGet.mockReturnValue(new Set(['src/routes/blog/+page.svelte']));
    const cleanup = vi.fn();
    mockCheckout.mockReturnValue({ analyzeCwd: fixtureDir, cleanup });
    const cap = capture();
    const code = await run({
      cwd: fixtureDir,
      diffBase: 'main',
      baseline: 'origin/main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(mockGet).toHaveBeenCalledWith(fixtureDir, { base: 'main' });
    expect(mockCheckout).toHaveBeenCalledWith(fixtureDir, 'origin/main');
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(code).toBe(0); // both filters applied -> nothing left to fail on
  });
});
