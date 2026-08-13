import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAnalysisRunner, type AnalyzeFn } from '../src/ui/analysis.js';
import type { ParseCache } from 'svelte-vitals';
import type { Result } from '@svelte-vitals/core';

// Wraps the real node:fs/promises#readFile in a spy so the integration test (plan
// 034) can count reads per file across two `analyzeProject` calls and prove that
// an unchanged route's parse-cache entry is reused rather than re-read. Every
// other test in this file uses an injected `analyze` mock and never touches disk,
// so wrapping (not replacing) the real implementation doesn't change their behavior.
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const R = (id: string): Result =>
  ({
    id,
    message: id,
    category: 'seo',
    detection: { presence: 'none', value: 'absent' },
    severity: 'critical'
  }) as Result;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('createAnalysisRunner', () => {
  it('start() runs the analysis once and reports results', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [R('seo/title-presence')] }));
    const onResults = vi.fn();
    const onError = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError });
    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(onResults).toHaveBeenCalledWith([R('seo/title-presence')]);
    expect(onError).not.toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledWith({
      cwd: '/proj',
      treatDynamicAs: undefined,
      metaComponents: undefined,
      rules: undefined,
      failOn: undefined,
      parseCache: expect.any(Map)
    });
  });

  it('passes failedRuleIds through to onResults as a 2nd arg when analyze returns them', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [], failedRuleIds: ['seo/title-presence'] }));
    const onResults = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError: vi.fn() });
    runner.start();
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(1));
    expect(onResults).toHaveBeenCalledWith([], ['seo/title-presence']);
  });

  it('calls onResults with a single arg when analyze omits failedRuleIds (existing callers unaffected)', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const onResults = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError: vi.fn() });
    runner.start();
    await vi.waitFor(() => expect(onResults).toHaveBeenCalledTimes(1));
    expect(onResults).toHaveBeenCalledWith([]);
  });

  it('coalesces N rapid notifyChange calls into a single debounced run', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      debounceMs: 500
    });
    runner.notifyChange('a.svelte');
    vi.advanceTimersByTime(100);
    runner.notifyChange('b.svelte');
    vi.advanceTimersByTime(100);
    runner.notifyChange('c.svelte');
    // still within the debounce window measured from the last call
    vi.advanceTimersByTime(499);
    expect(analyze).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(analyze).toHaveBeenCalledTimes(1);
  });

  it('a change that arrives mid-run produces exactly one follow-up run', async () => {
    let resolveFirst!: (v: { results: Result[] }) => void;
    const analyze = vi
      .fn<AnalyzeFn>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementation(async () => ({ results: [] }));
    const onResults = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError: vi.fn(), debounceMs: 10 });

    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));

    // A change arrives while the first run is still in flight.
    runner.notifyChange('a.svelte');
    await vi.advanceTimersByTimeAsync(20); // past the debounce window, but the run above hasn't resolved yet
    expect(analyze).toHaveBeenCalledTimes(1); // no second run started while the first is still running

    // More changes arriving during the same in-flight run must not queue more than one follow-up.
    runner.notifyChange('b.svelte');
    runner.notifyChange('c.svelte');
    await vi.advanceTimersByTimeAsync(20);
    expect(analyze).toHaveBeenCalledTimes(1);

    resolveFirst({ results: [] });
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2)); // exactly one follow-up, not three
  });

  it('a failed run calls onError and does not call onResults', async () => {
    const err = new Error('boom');
    const analyze = vi.fn<AnalyzeFn>(async () => {
      throw err;
    });
    const onResults = vi.fn();
    const onError = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError });
    runner.start();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(err));
    expect(onResults).not.toHaveBeenCalled();
  });

  it('stop() makes start() and notifyChange() no-ops', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults: vi.fn(), onError: vi.fn() });
    runner.stop();
    runner.start();
    runner.notifyChange('a.svelte');
    await vi.advanceTimersByTimeAsync(1000);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('stop() cancels a pending debounced run', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults: vi.fn(), onError: vi.fn() });
    runner.notifyChange('a.svelte');
    runner.stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('dynamic-imports svelte-vitals lazily when no analyze function is injected', async () => {
    // Real timers: this exercises the real 'svelte-vitals' package (dynamic-imported inside
    // the runner, never statically) end to end. An empty scratch dir (no package.json, no
    // svelte.config, no src/routes) is not a SvelteKit project, so analyzeProject's real
    // ProjectError surfaces through onError — proof this ran the real module, not a mock.
    vi.useRealTimers();
    const emptyDir = mkdtempSync(join(tmpdir(), 'svelte-vitals-ui-analysis-'));
    try {
      const onResults = vi.fn();
      const onError = vi.fn();
      const runner = createAnalysisRunner({ root: emptyDir, onResults, onError });
      runner.start();
      await vi.waitFor(
        () => {
          expect(onError).toHaveBeenCalledTimes(1);
        },
        { timeout: 5000 }
      );
      expect(onResults).not.toHaveBeenCalled();
      expect(String(onError.mock.calls[0]![0])).toMatch(/SvelteKit project/);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it('calls onStatusChange(true) then onStatusChange(false) around a successful run', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [] }));
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange
    });
    runner.start();
    await vi.waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith(false));
    expect(onStatusChange.mock.calls.map((c) => c[0])).toEqual([true, false]);
  });

  it('calls onStatusChange(false) even when the run fails', async () => {
    const analyze = vi.fn<AnalyzeFn>(async () => {
      throw new Error('boom');
    });
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange
    });
    runner.start();
    await vi.waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith(false));
  });

  it('re-fires onStatusChange(true) when a coalesced follow-up starts', async () => {
    let resolveFirst!: (v: { results: Result[] }) => void;
    const analyze = vi
      .fn<AnalyzeFn>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementation(async () => ({ results: [] }));
    const onStatusChange = vi.fn();
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      onStatusChange,
      debounceMs: 10
    });

    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    runner.notifyChange('a.svelte');
    await vi.advanceTimersByTimeAsync(20);

    resolveFirst({ results: [] });
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    expect(onStatusChange.mock.calls.map((c) => c[0])).toEqual([true, false, true, false]);
  });

  it('passes the same parseCache instance to every analyze() call across re-analyses (plan 034)', async () => {
    const seenCaches: (ParseCache | undefined)[] = [];
    const analyze = vi.fn<AnalyzeFn>(async (opts) => {
      seenCaches.push(opts.parseCache);
      return { results: [] };
    });
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      debounceMs: 10
    });

    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    runner.notifyChange('a.svelte');
    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));

    expect(seenCaches).toHaveLength(2);
    expect(seenCaches[0]).toBeInstanceOf(Map);
    // Reference identity — not just equal contents — is the direct evidence that the
    // runner reuses one long-lived cache instead of creating a fresh one per run.
    expect(seenCaches[1]).toBe(seenCaches[0]);
  });

  it("notifyChange evicts only the changed file's cache entry, leaving unrelated entries intact (plan 034)", async () => {
    let capturedCache: ParseCache | undefined;
    const analyze = vi.fn<AnalyzeFn>(async (opts) => {
      if (!capturedCache) {
        capturedCache = opts.parseCache;
        capturedCache?.set('src/routes/a/+page.svelte', Promise.resolve({}) as never);
        capturedCache?.set('src/routes/b/+page.svelte', Promise.resolve({}) as never);
      }
      return { results: [] };
    });
    const runner = createAnalysisRunner({
      root: '/proj',
      analyze,
      onResults: vi.fn(),
      onError: vi.fn(),
      debounceMs: 10
    });

    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(capturedCache?.size).toBe(2);

    // The watcher hands notifyChange an absolute, OS-separated path; only the entry
    // for that file (normalized to the cache's project-relative POSIX key) should go.
    runner.notifyChange(join('/proj', 'src', 'routes', 'a', '+page.svelte'));
    await vi.advanceTimersByTimeAsync(20);
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));

    expect(capturedCache?.has('src/routes/a/+page.svelte')).toBe(false);
    expect(capturedCache?.has('src/routes/b/+page.svelte')).toBe(true);
  });
});

describe('createAnalysisRunner integration: real analyzeProject reuses the parse cache (plan 034)', () => {
  it('does not re-parse an unrelated, unchanged route file on the second analysis after notifyChange', async () => {
    vi.useRealTimers();
    const root = mkdtempSync(join(tmpdir(), 'svelte-vitals-ui-analysis-cache-'));
    try {
      writeFileSync(join(root, 'svelte.config.js'), 'export default {};\n');
      mkdirSync(join(root, 'src/routes/a'), { recursive: true });
      mkdirSync(join(root, 'src/routes/b'), { recursive: true });
      const pageA = join(root, 'src/routes/a/+page.svelte');
      const pageB = join(root, 'src/routes/b/+page.svelte');
      writeFileSync(pageA, '<svelte:head><title>Page A</title></svelte:head>\n<h1>A</h1>\n');
      writeFileSync(pageB, '<svelte:head><title>Page B</title></svelte:head>\n<h1>B</h1>\n');

      const { analyzeProject } = await import('svelte-vitals');
      let calls = 0;
      let resolveRun1!: () => void;
      let resolveRun2!: () => void;
      const run1 = new Promise<void>((r) => (resolveRun1 = r));
      const run2 = new Promise<void>((r) => (resolveRun2 = r));
      const onResults = vi.fn(() => {
        calls++;
        if (calls === 1) resolveRun1();
        if (calls === 2) resolveRun2();
      });
      const onError = vi.fn((err: unknown) => {
        // Surface analysis failures loudly instead of hanging on the `run1`/`run2` awaits.
        calls++;
        resolveRun1();
        resolveRun2();
        throw err instanceof Error ? err : new Error(String(err));
      });
      const runner = createAnalysisRunner({
        root,
        analyze: (o) => analyzeProject(o),
        onResults,
        onError,
        debounceMs: 10
      });

      const readFileMock = vi.mocked(fsp.readFile);
      readFileMock.mockClear();
      const readsOf = (p: string) => readFileMock.mock.calls.filter(([callPath]) => String(callPath) === p).length;

      runner.start();
      await run1;
      const pageAReadsRun1 = readsOf(pageA);
      const pageBReadsRun1 = readsOf(pageB);
      // Both files are read twice on the first run: once by the independent, always-fresh
      // component scan (collectComponentFacts — out of this plan's scope) and once by the
      // route parse cache's initial (cold) miss.
      expect(pageAReadsRun1).toBe(2);
      expect(pageBReadsRun1).toBe(2);

      readFileMock.mockClear();
      writeFileSync(pageA, '<svelte:head><title>Page A v2</title></svelte:head>\n<h1>A</h1>\n');
      runner.notifyChange(pageA);
      await run2;

      const pageAReadsRun2 = readsOf(pageA);
      const pageBReadsRun2 = readsOf(pageB);
      // The changed file's cache entry was invalidated, so it's read twice again (same
      // as the cold run). The unrelated, unchanged file's cache entry is still warm, so
      // it's read only once — by the independent component scan; the route parse cache
      // reused its cached, already-parsed result instead of re-reading the file. This is
      // the plan's core evidence: unchanged files are not re-parsed on a debounced re-analysis.
      expect(pageAReadsRun2).toBe(2);
      expect(pageBReadsRun2).toBe(1);

      runner.stop();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 15000);
});
