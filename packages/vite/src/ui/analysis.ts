import { relative, sep } from 'node:path';
import type { Result, RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { analyzeProject, type ParseCache } from 'svelte-vitals';

/** The subset of `analyzeProject` (from `svelte-vitals`) the runner needs. Injectable for tests. */
export type AnalyzeFn = (opts: {
  cwd: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  parseCache?: ParseCache;
}) => Promise<{ results: Result[]; failedRuleIds?: string[]; warnings?: string[] }>;

export interface AnalysisRunnerOptions {
  /** Project root to analyze (passed as `cwd` to `analyzeProject`). */
  root: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  failOn?: Severity;
  /** `analyzeProject`-compatible function, injectable for tests. Defaults to `analyzeProject`. */
  analyze?: AnalyzeFn;
  /** `failedRuleIds` is `analyzeProject`'s crashed-rule ids — omitted when the injected `analyze` doesn't return them. Ids only, not a config: the base config (plugin-option weights/overrides included) must stay the caller's, never swapped for `analyzeProject`'s own. */
  onResults(results: Result[], failedRuleIds?: string[]): void;
  onError(err: unknown): void;
  /** `analyzeProject`'s human-readable warnings (empty selections, unknown directive ids, skipped files, crashed rules). Called only when the set differs from the previous run's — a debounced re-run per save would otherwise repeat the same lines. */
  onWarnings?(warnings: string[]): void;
  /** Called `true` right before a run starts its `analyze()` call and `false` once that run settles — including right before a coalesced follow-up starts again, so a rapid burst of changes may emit false-then-true between runs rather than staying true throughout. */
  onStatusChange?(analyzing: boolean): void;
  /** Debounce window for `notifyChange` (default: 500ms). */
  debounceMs?: number;
}

/**
 * Owns the dev-dashboard's whole-project analysis lifecycle: an async run at startup,
 * a debounced re-run on source changes, and coalescing so a change that arrives mid-run
 * produces exactly one follow-up run rather than one per change (design doc §1).
 */
export function createAnalysisRunner(opts: AnalysisRunnerOptions) {
  const debounceMs = opts.debounceMs ?? 500;
  const analyze = opts.analyze ?? analyzeProject;
  const parseCache: ParseCache = new Map();
  let stopped = false;
  let running = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastWarningsKey: string | undefined;

  async function runOnce(): Promise<void> {
    if (stopped) return;
    running = true;
    opts.onStatusChange?.(true);
    try {
      const result = await analyze({
        cwd: opts.root,
        treatDynamicAs: opts.treatDynamicAs,
        metaComponents: opts.metaComponents,
        rules: opts.rules,
        failOn: opts.failOn,
        parseCache
      });
      const { results, failedRuleIds } = result;
      // Passing a 2nd arg only when defined keeps callers that ignore it (and tests
      // asserting exact call args) unaffected by this addition.
      if (!stopped) {
        if (failedRuleIds !== undefined) opts.onResults(results, failedRuleIds);
        else opts.onResults(results);
      }
      const warnings = result.warnings ?? [];
      const key = warnings.join('\n');
      if (!stopped && warnings.length > 0 && key !== lastWarningsKey) opts.onWarnings?.(warnings);
      lastWarningsKey = key;
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
    /** Kick off the first whole-project analysis. Fire-and-forget — never blocks the caller. */
    start() {
      if (stopped) return;
      void runOnce();
    },
    /** A relevant source file changed; schedule a debounced re-analysis. */
    notifyChange(file: string) {
      if (stopped) return;
      // Invalidate only the changed file's cache entry — the ParseCache is keyed
      // by project-root-relative POSIX path (as globFiles returns it), while the
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
