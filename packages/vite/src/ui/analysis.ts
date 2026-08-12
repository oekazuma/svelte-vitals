import { relative, sep } from 'node:path';
import type { Config, Result, RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { analyzeProject, type ParseCache } from 'svelte-vitals';

/** The subset of `analyzeProject` (from `svelte-vitals`) the runner needs. Injectable for tests. */
export type AnalyzeFn = (opts: {
  cwd: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  parseCache?: ParseCache;
}) => Promise<{ results: Result[]; config?: Config }>;

export interface AnalysisRunnerOptions {
  /** Project root to analyze (passed as `cwd` to `analyzeProject`). */
  root: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  /** `analyzeProject`-compatible function, injectable for tests. Defaults to `analyzeProject`. */
  analyze?: AnalyzeFn;
  /** `config` is `analyzeProject`'s failure-adjusted config (crashed rules forced `'off'`) — omitted when the injected `analyze` doesn't return one. */
  onResults(results: Result[], config?: Config): void;
  onError(err: unknown): void;
  /** Called `true` right before a run starts its `analyze()` call and `false` once that run settles — including right before a coalesced follow-up starts again, so a rapid burst of changes may emit false-then-true between runs rather than staying true throughout. */
  onStatusChange?(analyzing: boolean): void;
  /** Debounce window for `notifyChange` (default: 500ms). */
  debounceMs?: number;
}

export interface AnalysisRunner {
  /** Kick off the first whole-project analysis. Fire-and-forget — never blocks the caller. */
  start(): void;
  /** A relevant source file changed; schedule a debounced re-analysis. */
  notifyChange(file: string): void;
  /** Stop the runner: clears any pending timer and makes further calls no-ops. */
  stop(): void;
}

/**
 * Owns the dev-dashboard's whole-project analysis lifecycle: an async run at startup,
 * a debounced re-run on source changes, and coalescing so a change that arrives mid-run
 * produces exactly one follow-up run rather than one per change (design doc §1).
 */
export function createAnalysisRunner(opts: AnalysisRunnerOptions): AnalysisRunner {
  const debounceMs = opts.debounceMs ?? 500;
  const analyze = opts.analyze ?? analyzeProject;
  const parseCache: ParseCache = new Map();
  let stopped = false;
  let running = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function runOnce(): Promise<void> {
    if (stopped) return;
    running = true;
    opts.onStatusChange?.(true);
    try {
      const { results, config } = await analyze({
        cwd: opts.root,
        treatDynamicAs: opts.treatDynamicAs,
        metaComponents: opts.metaComponents,
        rules: opts.rules,
        failOn: opts.failOn,
        parseCache
      });
      // Passing a 2nd arg only when defined keeps callers that ignore it (and tests
      // asserting exact call args) unaffected by this addition.
      if (!stopped) {
        if (config !== undefined) opts.onResults(results, config);
        else opts.onResults(results);
      }
    } catch (err) {
      if (!stopped) opts.onError(err);
    } finally {
      running = false;
      opts.onStatusChange?.(false);
      if (!stopped && pending) {
        pending = false;
        void runOnce();
      }
    }
  }

  return {
    start() {
      if (stopped) return;
      void runOnce();
    },
    notifyChange(file: string) {
      if (stopped) return;
      // Invalidate only the changed file's cache entry — the ParseCache is keyed
      // by project-root-relative POSIX path (as tinyglobby returns it), while the
      // watcher hands us an absolute, OS-separated path, so normalize to match.
      const rel = relative(opts.root, file).split(sep).join('/');
      parseCache.delete(rel);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        if (stopped) return;
        if (running) pending = true;
        else void runOnce();
      }, debounceMs);
    },
    stop() {
      stopped = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending = false;
    }
  };
}
