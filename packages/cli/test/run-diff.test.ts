import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Mock the git layer so run()'s --diff/--staged gating is testable without a real repo.
vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});

import { run } from '../src/index.js';
import { getChangedFiles } from '../src/changed-files.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const CLEAN_ENV: NodeJS.ProcessEnv = {};
const mockGet = vi.mocked(getChangedFiles);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (l: string) => out.push(l), errorLog: (l: string) => err.push(l) };
}

describe('run() --diff / --staged gating', () => {
  beforeEach(() => mockGet.mockReset());

  it('passes (exit 0) when no changed file has a finding', async () => {
    mockGet.mockReturnValue(new Set(['README.md'])); // a changed file with no svelte-vitals findings
    const cap = capture();
    const code = await run({ cwd: fixtureDir, diffBase: 'HEAD', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(0);
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
  });

  it('--staged queries staged files and takes precedence over diffBase', async () => {
    mockGet.mockReturnValue(new Set());
    const cap = capture();
    await run({
      cwd: fixtureDir,
      staged: true,
      diffBase: 'main',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(mockGet).toHaveBeenCalledWith(fixtureDir, { staged: true });
  });

  it('warns and analyzes everything when git cannot answer', async () => {
    mockGet.mockReturnValue(undefined);
    const cap = capture();
    const code = await run({ cwd: fixtureDir, diffBase: 'HEAD', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.err.join('\n')).toContain('could not determine changed files');
    expect(code).toBe(1); // same as an unscoped run — findings still surface
    expect(cap.out.join('\n')).toContain('seo/title-presence');
  });
});
