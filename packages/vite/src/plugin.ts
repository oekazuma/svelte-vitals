import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, isAbsolute, dirname, relative, basename, sep } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { defineConfig } from '@svelte-vitals/core';
import { analyze } from './analyze.js';
import { installUiMiddleware } from './ui/middleware.js';
import { createStore } from './ui/store.js';
import { createAnalysisRunner } from './ui/analysis.js';
import { readPackageVersion, readCoreVersion } from './version.js';

const CONFIG_BASENAMES = new Set([
  'svelte.config.js',
  'svelte.config.ts',
  'svelte-vitals.config.mjs',
  'svelte-vitals.config.js',
  'svelte-vitals.config.ts'
]);

const IGNORED_SEGMENTS = new Set(['node_modules', '.svelte-kit', 'build', 'dist']);

/**
 * Whether a `server.watcher` event on `file` should trigger a dev-dashboard re-analysis:
 * anything under `src/` or `static/` (the default SvelteKit layout this dashboard assumes),
 * or a `svelte.config.*` / `svelte-vitals.config.*` at any depth — excluding build/dependency
 * output so their churn never triggers a spurious re-run. Exported for tests.
 */
export function isRelevant(file: string, root: string): boolean {
  const rel = relative(root, file);
  if (rel === '' || rel.startsWith('..')) return false; // outside the project root
  const segments = rel.split(sep);
  if (segments.some((s) => IGNORED_SEGMENTS.has(s))) return false;
  if (CONFIG_BASENAMES.has(basename(file))) return true;
  return segments[0] === 'src' || segments[0] === 'static';
}

export interface SvelteVitalsOptions {
  /** Project root (defaults to the Vite config root / cwd). */
  cwd?: string;
  treatDynamicAs?: TreatDynamicAs;
  metaComponents?: string[];
  rules?: Record<string, RuleSetting>;
  /** Minimum severity that fails the build (default: 'critical'). */
  failOn?: Severity;
  /** Report output (default: 'console'). */
  report?: 'console' | 'json' | false;
  /** Write the JSON report to this path. */
  outFile?: string;
  /** Override the prerendered-pages directory (default: .svelte-kit/output/prerendered/pages). */
  prerenderDir?: string;
  /**
   * Serve a live dashboard at /__svelte-vitals/ during `vite dev` (add
   * svelteVitalsHandle to hooks.server.ts for accurate, per-route `measured` results
   * as you browse — the dashboard still works without it, from whole-project static
   * analysis alone). Default: `true`. Pass `false` to keep only the build-time gate.
   */
  ui?: boolean;
}

const DEFAULT_PRERENDER_DIR = '.svelte-kit/output/prerendered/pages';

/** svelte-vitals Vite/SvelteKit plugin. */
export function svelteVitals(options: SvelteVitalsOptions = {}): Plugin | Plugin[] {
  let root = options.cwd ?? process.cwd();
  const buildPlugin: Plugin = {
    name: 'svelte-vitals',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      if (!options.cwd) root = config.root;
    },
    async closeBundle() {
      const pagesDir = options.prerenderDir ? options.prerenderDir : join(root, DEFAULT_PRERENDER_DIR);
      const resolved = isAbsolute(pagesDir) ? pagesDir : join(root, pagesDir);

      // SvelteKit calls closeBundle TWICE: once during the JS bundle phase
      // (before prerendering, dir absent) and once after the adapter writes
      // prerendered HTML (Task 2 spike). Skip the early/empty invocation so we
      // don't emit a spurious "0 routes" report or gate on nothing.
      if (!existsSync(resolved)) return;

      let result;
      try {
        result = await analyze(resolved, root, options);
      } catch (err) {
        // The analysis itself failed (unreadable/malformed output, glob error,
        // …). That's our problem, not a real SEO finding, so warn and skip the
        // gate instead of failing the whole build — distinct from `result.failed`.
        console.warn(`svelte-vitals: skipped — analysis failed: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
      if (result.routeCount === 0) return;

      if (options.report !== false) {
        const out = options.report === 'json' ? result.jsonReport : result.consoleReport;
        console.log(out);
      }
      if (options.outFile) {
        const outPath = isAbsolute(options.outFile) ? options.outFile : join(root, options.outFile);
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, result.jsonReport);
      }
      if (result.failed) {
        throw new Error(`svelte-vitals: build failed — findings at or above "${result.failOn}".`);
      }
    }
  };

  // `ui` defaults to true: the plugin's real dev-time value is the live dashboard
  // (2026-07-12-retire-dev-overlay-design.md) — pass `ui: false` to keep only the
  // build-time gate.
  if (options.ui === false) return buildPlugin;

  const uiPlugin: Plugin = {
    name: 'svelte-vitals:ui',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      process.env.SVELTE_VITALS_UI = '1';
      const config = defineConfig({
        treatDynamicAs: options.treatDynamicAs ?? 'pass',
        metaComponents: options.metaComponents ?? [],
        rules: options.rules ?? {},
        failOn: options.failOn ?? 'critical'
      });
      const store = createStore();
      const uiRoot = options.cwd ?? server.config.root;

      // Whole-project static analysis: one run at startup (never blocking dev-server
      // start) plus a debounced re-run on relevant source changes (design doc
      // 2026-07-08-dev-dashboard-whole-project-design.md). Failures are warned and the
      // previous static layer (if any) is kept — the dashboard falls back to live-only.
      const runner = createAnalysisRunner({
        root: uiRoot,
        treatDynamicAs: options.treatDynamicAs,
        metaComponents: options.metaComponents,
        rules: options.rules,
        failOn: options.failOn,
        onResults: (results) => store.setStatic(results),
        onError: (err) => console.warn('[svelte-vitals] dev analysis failed:', err),
        onStatusChange: (analyzing) => store.setAnalyzing(analyzing)
      });
      runner.start();
      server.watcher?.on('all', (_event, file) => {
        if (isRelevant(file, uiRoot)) runner.notifyChange(file);
      });

      // Clear the flag and stop the runner when the dev server stops, so the handle
      // doesn't keep POSTing to a no-longer-mounted endpoint after a restart / config
      // flip, and no re-analysis timer outlives the server.
      server.httpServer?.once('close', () => {
        delete process.env.SVELTE_VITALS_UI;
        runner.stop();
      });

      installUiMiddleware(server, config, readPackageVersion(), store, readCoreVersion());

      // The dashboard has no separate CLI entry point (unlike `vitest --ui`) to signal
      // it exists, so announce it the same way Vite announces its own dev server: as an
      // extra line appended after Vite's own "Local:/Network:" URL block. Wrapping
      // printUrls (rather than logging eagerly here) means the line only appears once
      // the server is actually listening and prints in the same place a developer's eyes
      // already are on every `vite dev` start.
      if (typeof server.printUrls === 'function') {
        const printUrls = server.printUrls.bind(server);
        server.printUrls = () => {
          printUrls();
          const printed = server.resolvedUrls?.local?.[0] ?? server.resolvedUrls?.network?.[0];
          if (printed) {
            // installUiMiddleware always mounts at the server root ('/__svelte-vitals'),
            // regardless of a configured `base` — a non-root base makes Vite print a URL
            // with a path segment (e.g. http://host:5173/my-app/), so resolving
            // '__svelte-vitals/' relative to that would announce the wrong, 404ing URL.
            // Use the origin only and always append the root-mounted path ourselves.
            console.log(`  ➜  svelte-vitals: ${new URL(printed).origin}/__svelte-vitals/`);
          }
        };
      }
    }
  };
  return [buildPlugin, uiPlugin];
}
