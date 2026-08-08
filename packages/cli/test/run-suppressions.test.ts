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
          { id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'seo/title-presence', route: '/widget', location: 'src/routes/widget/+page.svelte' }
        ]
      })
    );
    const cap = capture();
    await run({ cwd: dir, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(cap.err.join('\n')).toContain(`2 finding(s) suppressed by ${SUPPRESSIONS_FILE}`);
  });

  it('--no-suppressions ignores the file for the run', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' }]
      })
    );
    const cap = capture();
    await run({ cwd: dir, noSuppressions: true, log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.out.join('\n')).toContain('seo/title-presence');
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
    expect(written.suppressions.some((e: { id: string }) => e.id === 'seo/title-presence')).toBe(true);
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
    expect(allSuppressedCap.out.join('\n')).not.toContain('seo/title-presence');

    // 3. Simulate a new/un-suppressed finding by dropping one accepted entry from the
    //    file — the corresponding finding is "new" relative to the suppressions file
    //    and must surface (and fail the gate) again.
    const written = JSON.parse(readFileSync(join(dir, SUPPRESSIONS_FILE), 'utf8')) as {
      version: 1;
      suppressions: { id: string; route?: string; location?: string }[];
    };
    const withoutOneEntry = {
      version: 1,
      suppressions: written.suppressions.filter((e) => !(e.id === 'seo/title-presence' && e.route === '/none'))
    };
    writeFileSync(join(dir, SUPPRESSIONS_FILE), JSON.stringify(withoutOneEntry));

    const newFindingCap = capture();
    const newFindingCode = await run({
      cwd: dir,
      log: newFindingCap.log,
      errorLog: newFindingCap.errorLog,
      env: CLEAN_ENV
    });
    expect(newFindingCap.out.join('\n')).toContain('seo/title-presence');
    expect(newFindingCode).toBe(1);
  });

  it('reports a stale-entry count on stderr without failing the run', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' },
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

  it('a fully-suppressed rule still appears in the json report, with findings: 0', async () => {
    const dir = makeProjectCopy();
    // /img's only <img> is missing width/height -> the fixture's single performance/image-dimensions
    // finding. Suppressing it should zero the count without dropping the rule from `rules` —
    // that only holds if the ran-rule ids reach formatJsonReport ahead of suppression removing the result.
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'performance/image-dimensions', route: '/img', location: 'src/routes/img/+page.svelte' }]
      })
    );
    const cap = capture();
    await run({ cwd: dir, log: cap.log, errorLog: cap.errorLog, reporter: 'json', env: CLEAN_ENV });
    const json = JSON.parse(cap.out.join('\n'));
    expect(json.rules['performance/image-dimensions']).toEqual({ findings: 0, passed: 0 });
  });

  it('applies after --diff: diff narrows first, suppressions removes what remains', async () => {
    const dir = makeProjectCopy();
    // The "none" route's file has several penalized findings (seo/title-presence, seo/canonical-url, ...);
    // only seo/title-presence is accepted here, so it must be gone from the output while a
    // sibling finding on the same (diff-narrowed) file still surfaces.
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [{ id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' }]
      })
    );
    mockGet.mockReturnValue(new Set(['src/routes/none/+page.svelte']));
    const cap = capture();
    // seo/title-presence is 'critical' (suppressed here) but seo/canonical-url is only 'warning' — force
    // --fail-on warning so the still-unsuppressed seo/canonical-url keeps the gate failing,
    // proving suppressions removed exactly seo/title-presence and nothing more.
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
    expect(cap.out.join('\n')).not.toContain('seo/title-presence');
    expect(cap.out.join('\n')).toContain('seo/canonical-url'); // same diff-narrowed file, not suppressed -> still fails the gate
    expect(code).toBe(1);
    // The one entry that did match is used, so it isn't stale either.
    expect(cap.err.join('\n')).not.toContain('stale');
  });

  it('the CI recipe (--diff against a base branch): entries outside the diff scope are not stale when their findings still exist project-wide', async () => {
    const dir = makeProjectCopy();
    // Both entries' findings are real and still present on /none and /widget — the diff below
    // just doesn't touch those files.
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'seo/title-presence', route: '/widget', location: 'src/routes/widget/+page.svelte' }
        ]
      })
    );
    mockGet.mockReturnValue(new Set(['src/routes/img/+page.svelte']));
    const cap = capture();
    await run({ cwd: dir, diffBase: 'main', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    // Neither entry's file is in the diff scope, so nothing is suppressed in-scope — but under
    // the old bug, both entries would have been counted stale (0 suppressed, "2 stale entries")
    // even though their findings are still there, just outside this diff.
    expect(cap.err.join('\n')).not.toContain('suppressed by');
    expect(cap.err.join('\n')).not.toContain('stale');
    // /img's own real, unsuppressed finding still surfaces — the diff scope itself is unaffected.
    expect(cap.out.join('\n')).toContain('performance/image-dimensions');
  });

  it('a genuinely stale entry (matches nothing project-wide) is still reported stale under --diff scoping', async () => {
    const dir = makeProjectCopy();
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'SEO999', route: '/does-not-exist' } // never matches anywhere -> genuinely stale
        ]
      })
    );
    mockGet.mockReturnValue(new Set(['src/routes/none/+page.svelte']));
    const cap = capture();
    await run({ cwd: dir, diffBase: 'main', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.err.join('\n')).toContain(`1 finding(s) suppressed by ${SUPPRESSIONS_FILE}`);
    expect(cap.err.join('\n')).toContain('1 stale entry');
  });

  it('--route run: the stale clause is omitted (staleness against a route-narrowed set is unknowable)', async () => {
    const dir = makeProjectCopy();
    // /widget's entry has a real, still-current finding — just not inside the --route scope
    // below, where it can't be told apart from a genuinely fixed one.
    writeFileSync(
      join(dir, SUPPRESSIONS_FILE),
      JSON.stringify({
        version: 1,
        suppressions: [
          { id: 'seo/title-presence', route: '/none', location: 'src/routes/none/+page.svelte' },
          { id: 'seo/title-presence', route: '/widget', location: 'src/routes/widget/+page.svelte' }
        ]
      })
    );
    const cap = capture();
    await run({ cwd: dir, route: 'none', log: cap.log, errorLog: cap.errorLog, env: CLEAN_ENV });
    expect(cap.err.join('\n')).toContain(`1 finding(s) suppressed by ${SUPPRESSIONS_FILE}`);
    expect(cap.err.join('\n')).not.toContain('stale');
  });

  it('--update-suppressions refuses to run combined with --route (it would prune entries outside that route)', async () => {
    const dir = makeProjectCopy();
    const cap = capture();
    const code = await run({
      cwd: dir,
      updateSuppressions: true,
      route: 'none',
      log: cap.log,
      errorLog: cap.errorLog,
      env: CLEAN_ENV
    });
    expect(code).toBe(2);
    expect(cap.err.join('\n')).toContain('--update-suppressions cannot be combined with --route');
    expect(cap.out).toEqual([]);
  });
});
