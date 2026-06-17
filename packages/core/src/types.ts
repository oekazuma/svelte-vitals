/**
 * Core type definitions shared across modes. This module is pure: no I/O, no
 * `node:` imports, no runtime-specific globals (design §8).
 */

export type Severity = 'critical' | 'warning' | 'info';

/** Where a head tag is set, relative to the route being evaluated (design §4). */
export type Presence = 'own' | 'inherited' | 'none';

/** How a tag's value is determined (design §4). */
export type Value = 'static' | 'dynamic' | 'absent';

/**
 * Two-axis detection result. Kept independent so combinations such as
 * "inherited + dynamic" remain expressible (design §4).
 */
export interface Detection {
  presence: Presence;
  value: Value;
}

/** A single rule finding for one route (or the whole project). */
export interface Result {
  /** Rule id, e.g. 'SEO001'. */
  id: string;
  severity: Severity;
  detection: Detection;
  /** Route path, e.g. '/blog/[slug]'. Omitted for project-scoped rules. */
  route?: string;
  /** Source location, e.g. 'src/routes/blog/[slug]/+page.svelte'. */
  location?: string;
  message: string;
  recommendation?: string;
  docsUrl?: string;
}

export type Scope = 'route' | 'project';

export type Category = 'seo' | 'performance' | 'a11y' | 'maintainability';

/** How dynamic (`{data.title}`) values are treated by scoring (design §4, §12). */
export type TreatDynamicAs = 'pass' | 'warn' | 'fail';

export interface Config {
  treatDynamicAs: TreatDynamicAs;
}

export const defaultConfig: Config = {
  treatDynamicAs: 'pass'
};

/** Merge user config over defaults. Identity helper for config files (design §6). */
export function defineConfig(config: Partial<Config> = {}): Config {
  return { ...defaultConfig, ...config };
}
