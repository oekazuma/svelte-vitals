import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, isAbsolute, dirname } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import type { RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { defineConfig } from '@svelte-vitals/core';
import { analyze } from './analyze.js';
import { installUiMiddleware } from './ui/middleware.js';
import { readPackageVersion, readCoreVersion } from './version.js';

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
  /** Serve a live dashboard at /__svelte-vitals/ during `vite dev` (requires svelteVitalsHandle in hooks.server.ts). */
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

  if (!options.ui) return buildPlugin;

  const uiPlugin: Plugin = {
    name: 'svelte-vitals:ui',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      process.env.SVELTE_VITALS_UI = '1';
      // Clear the flag when the dev server stops, so the handle doesn't keep
      // POSTing to a no-longer-mounted endpoint after a restart / config flip.
      server.httpServer?.once('close', () => {
        delete process.env.SVELTE_VITALS_UI;
      });
      const config = defineConfig({
        treatDynamicAs: options.treatDynamicAs ?? 'pass',
        metaComponents: options.metaComponents ?? [],
        rules: options.rules ?? {},
        failOn: options.failOn ?? 'critical'
      });
      installUiMiddleware(server, config, readPackageVersion(), readCoreVersion());
    }
  };
  return [buildPlugin, uiPlugin];
}
