import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// Mock the diff layer so the ordering test doesn't need a real git repo, following
// run-diff.test.ts's / run-baseline.test.ts's pattern for the analogous layers.
vi.mock('../src/changed-files.js', async (orig) => {
  const actual = await orig<typeof import('../src/changed-files.js')>();
  return { ...actual, getChangedFiles: vi.fn() };
});

import { run } from '../src/index.js';
import { getChangedFiles } from '../src/changed-files.js';
import { SUPPRESSIONS_FILE } from '../src/suppressions.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures', 'basic-project');
const CLEAN_ENV: NodeJS.ProcessEnv = {};
const mockGet = vi.mocked(getChangedFiles);

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, log: (l: string) => out.push(l), errorLog: (l: string) => err.push(l) };
}

// --update-suppressions writes into cwd, so every test in this file runs against a
// throwaway copy of the fixture rather than the checked-in fixtures/basic-project.
const dirs: string[] = [];
function makeProjectCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), 'svelte-vitals-suppressions-run-'));
  dirs.push(dir);
  cpSync(fixtureDir, dir, { recursive: true });
  return dir;
}

describe('run() svelte-vitals-suppressions.json', () => {
  beforeEach(() => mockGet.mockReset());
  afterEach(() => {
    while (dirs.length > 0) {
      const dir = dirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('auto-applies the file when present: suppressed findings disappear and stderr reports the count', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'SEO001', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'SEO001', route: '/widget', location: 'src/routes/widget/+page.svelte' }
        ]
      })
    );
    const cap = capture();
    await run({ cwd: dir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.out.join('\n')).not.toContain('SEO001');
    expect(cap.err.join('\n')).toContain(`2 finding(s) suppressed by ${SUPPRESSIONS_FILE}`);
  });

  it('--no-suppressions ignores the file for the run', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'SEO001', route: '/none', location: 'src/routes/none/+page.svelte' }]
      })
    );
    const cap = capture();
    await run({ cwd: dir, noSuppressions: true, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.out.join('\n')).toContain('SEO001');
    expect(cap.err.join('\n')).not.toContain('suppressed by');
  });

  it('--update-suppressions writes the file, exits 0, and skips reporter output', async () => {
    const dir = makeProjectCopy();
    const cap = capture();
    const code = await run({
      cwd: dir,
      updateSuppressions: true,
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(code).toBe(0);
    expect(cap.out).toEqual([]); // reporter output is skipped in update mode
    expect(cap.err.some((l) => l.includes(`wrote`) && l.includes(SUPPRESSIONS_FILE))).toBe(true);

    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8'));
    expect(written.version).toBe(1);
    expect(written.suppressions.length).toBeGreaterThan(0);
    expect(written.suppressions.some((e: { id: string }) => e.id === 'SEO001')).toBe(true);
  });

  it('adoption-ramp sequence: update accepts everything, a re-run suppresses it all, and a subsequently-un-suppressed finding still fails', async () => {
    const dir = makeProjectCopy();

    // 1. Record the current state.
    const updateCap = capture();
    const updateCode = await run({
      cwd: dir,
      updateSuppressions: true,
      log: updateCap.log,
      errorLog: updateCap.errorLog,
      env: CLEAN_ENV
    });
    expect(updateCode).toBe(0);

    // 2. Re-running normally now suppresses every previously-recorded finding.
    const allSuppressedCap = capture();
    const allSuppressedCode = await run({
      cwd: dir,
      log: allSuppressedCap.log,
      errorLog: allSuppressedCap.errorLog,
      env: CLEAN_ENV
    });
    expect(allSuppressedCode).toBe(0);
    expect(allSuppressedCap.out.join('\n')).not.toContain('SEO001');

    // 3. Simulate a new/un-suppressed finding by dropping one accepted entry from the
    //    file — the corresponding finding is "new" relative to the suppressions file
    //    and must surface (and fail the gate) again.
    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8')) as {
      version: 1;
      suppressions: { id: string; route?: string; location?: string }[];
    };
    const withoutOneEntry = {
      version: 1,
      suppressions: written.suppressions.filter((e) => !(e.id === 'SEO001' && e.route === '/none'))
    };
    writeFileSync(join(dir, SUPPRESSIONS_FILE), JSON.stringify(withoutOneEntry));

    const newFindingCap = capture();
    const newFindingCode = await run({
      cwd: dir,
      log: newFindingCap.log,
      errorLog: newFindingCap.errorLog,
      env: CLEAN_ENV
    });
    expect(newFindingCap.out.join('\n')).toContain('SEO001');
    expect(newFindingCode).toBe(1);
  });

  it('reports a stale-entry count on stderr without failing the run', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'SEO001', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'SEO999', route: '/does-not-exist' } // never matches -> stale
        ]
      })
    );
    const cap = capture();
    await run({ cwd: dir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.err.join('\n')).toContain('1 stale entry');
    expect(cap.err.join('\n')).toContain('--update-suppressions');
  });

  it('a malformed suppressions file is a fatal error (exit 2)', async () => {
    const dir = makeProjectCopy();
    writeFileSync(join(dir, SUPPRESSIONS_FILE), '{not json');
    const cap = capture();
    const code = await run({ cwd: dir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain(`svelte-vitals: invalid ${SUPPRESSIONS_FILE}`);
  });

  it('applies after --diff: diff narrows first, suppressions removes what remains', async () => {
    const dir = makeProjectCopy();
    // The "none" route's file has several penalized findings (SEO001, SEO003, ...);
    // only SEO001 is accepted here, so it must be gone from the output while a
    // sibling finding on the same (diff-narrowed) file still surfaces.
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'SEO001', route: '/none', location: 'src/routes/none/+page.svelte' }]
      })
    );
    mockGet.mockReturnValue(new Set(['src/routes/none/+page.svelte']));
    const cap = capture();
    // SEO001 is 'critical' (suppressed here) but SEO003 is only 'warning' — force
    // --fail-on warning so the still-unsuppressed SEO003 keeps the gate failing,
    // proving suppressions removed exactly SEO001 and nothing more.
    const code = await run({
      cwd: dir,
      diffBase: 'main',
      failOn: 'warning',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(mockGet).toHaveBeenCalledWith(dir, { base: 'main' });
    expect(cap.err.join('\n')).toContain(`1 finding(s) suppressed by ${SUPPRESSIONS_FILE}`);
    expect(cap.out.join('\n')).not.toContain('SEO001');
    expect(cap.out.join('\n')).toContain('SEO003'); // same diff-narrowed file, not suppressed -> still fails the gate
    expect(code).toBe(1);
  });
});
