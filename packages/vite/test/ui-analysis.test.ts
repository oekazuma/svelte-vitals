import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAnalysisRunner, type AnalyzeFn } from '../src/ui/analysis.js';
import type { Result } from '@svelte-vitals/core';

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
    const analyze = vi.fn<AnalyzeFn>(async () => ({ results: [R('SEO001')] }));
    const onResults = vi.fn();
    const onError = vi.fn();
    const runner = createAnalysisRunner({ root: '/proj', analyze, onResults, onError });
    runner.start();
    await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(1));
    expect(onResults).toHaveBeenCalledWith([R('SEO001')]);
    expect(onError).not.toHaveBeenCalled();
    expect(analyze).toHaveBeenCalledWith({
      cwd: '/proj',
      treatDynamicAs: undefined,
      metaComponents: undefined,
      rules: undefined,
      failOn: undefined
    });
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
});
