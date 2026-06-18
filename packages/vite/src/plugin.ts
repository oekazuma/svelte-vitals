import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { Plugin } from 'vite';
import type { RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';
import { analyze } from './analyze.js';

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
}

const DEFAULT_PRERENDER_DIR = '.svelte-kit/output/prerendered/pages';

/** svelte-vitals Vite/SvelteKit plugin. */
export function svelteVitals(options: SvelteVitalsOptions = {}): Plugin {
  let root = options.cwd ?? process.cwd();
  return {
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
      const result = await analyze(resolved, root, options);
      if (result.routeCount === 0) return;

      if (options.report !== false) {
        const out = options.report === 'json' ? result.jsonReport : result.consoleReport;
        // eslint-disable-next-line no-console
        console.log(out);
      }
      if (result.failed) {
        throw new Error(`svelte-vitals: build failed — findings at or above "${options.failOn ?? 'critical'}".`);
      }
    }
  };
}
