import type { RuleSetting } from '@svelte-vitals/core';

/** Options for the dev-time SvelteKit handle. A focused subset of the plugin options. */
export interface SvelteVitalsHookOptions {
  /** Component names treated as meta sources (design §11 layer 4). Mirrors the plugin option. */
  metaComponents?: string[];
  /** Per-rule overrides keyed by rule id, e.g. `{ 'seo/json-ld': 'off' }`. Mirrors the plugin option. */
  rules?: Record<string, RuleSetting>;
}
