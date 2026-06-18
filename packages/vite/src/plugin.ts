import type { Plugin } from 'vite';
import type { RuleSetting, Severity, TreatDynamicAs } from '@svelte-vitals/core';

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

/** svelte-vitals Vite/SvelteKit plugin (skeleton — analysis added in Task 5). */
export function svelteVitals(options: SvelteVitalsOptions = {}): Plugin {
  void options;
  return {
    name: 'svelte-vitals',
    apply: 'build'
  };
}
