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

/** Project-wide facts precomputed by the runtime layer for project-scope rules (design §10). */
export interface Project {
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  /** <html lang> from app.html: presence 'own' when the attribute exists ('none' otherwise); value 'static' if non-empty, 'absent' if empty. */
  htmlLang: Detection;
  /** Whether the static static/robots.txt references a sitemap (`Sitemap:` line). Undefined for a +server endpoint / absent / unreadable. */
  robotsReferencesSitemap?: boolean;
  /**
   * Set when the Vite config disables minification for production builds (performance/minify-disabled).
   * `file` is the config path relative to the analyzed root (posix, may start with `../`
   * in monorepos); unset for inline programmatic configs. `line` is 1-based and set only
   * when the literal `minify: false` was located in that file; unset when the value was
   * resolved at build time (plugin/conditional config).
   */
  viteMinifyDisabled?: { file?: string; line?: number };
  /**
   * Set when the project configures a non-empty `kit.paths.base` — read from the `sveltekit()`
   * Vite plugin config, else `svelte.config.{js,ts}` (correctness/base-path-navigation).
   * `value` is the literal base when statically resolvable, unset when the config computes it
   * (e.g. `dev ? '' : '/repo'`). `file` is the config path relative to the analyzed root (posix).
   * Absent means the app is served at the root — the rule stays silent.
   */
  kitPathsBase?: { value?: string; file: string };
}

export const defaultProject: Project = {
  hasRobotsTxt: false,
  hasSitemap: false,
  htmlLang: { presence: 'none', value: 'absent' }
};

/** A concrete, agent-actionable remediation for a finding (design §10, issue #18). */
export interface Fix {
  /** One-line imperative instruction, e.g. 'Add a <meta name="description"> inside <svelte:head>.' */
  description: string;
  /** Concrete code to insert or a file's contents to create. */
  snippet?: string;
  /** Markdown fenced-code language for `snippet` (default 'svelte'). */
  lang?: string;
}

/** A single rule finding for one route (or the whole project). */
export interface Result {
  /** Rule id, e.g. 'seo/title-presence'. */
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
  /** Agent-actionable remediation (issue #18). */
  fix?: Fix;
  /** Vitals category this finding belongs to (default 'seo' when absent). */
  category?: Category;
  /** 1-based source line for element-level findings (e.g. a specific <img>). */
  line?: number;
}

export type Scope = 'route' | 'project' | 'component';

export type Category = 'seo' | 'performance' | 'correctness' | 'security' | 'architecture';

/** How dynamic (`{data.title}`) values are treated by scoring (design §4, §12). */
export type TreatDynamicAs = 'pass' | 'warn' | 'fail';

/** Resolved option values handed to a rule at check time. */
export type RuleOptions = Record<string, unknown>;

/**
 * Object form of a rule setting. `severity` omitted keeps the rule's built-in
 * severity — the common case when only a threshold is being moved.
 * `{ severity: 'off', … }` disables the rule and any `options` beside it are
 * inert (equivalent to the bare `'off'` string, not an error).
 */
export interface RuleSettingObject {
  severity?: Severity | 'off';
  options?: RuleOptions;
}

/** Per-rule override: disable, change severity, and/or set options. */
export type RuleSetting = 'off' | Severity | RuleSettingObject;

/**
 * Scoped rule override (design 2026-07-18), applied to results after analysis.
 * An entry matches a finding when any `route` glob matches its route id or any
 * `files` glob matches its source location; at least one of the two must be
 * set. Glob syntax: `*` matches within a segment, `**` across segments, a
 * trailing `/**` also matches the bare prefix, and all other characters
 * (including SvelteKit's `(`, `)`, `[`, `]`) are literal.
 */
export interface RuleOverride {
  /**
   * Route-id glob(s), e.g. '/admin/**'. Note route ids drop `(group)` segments
   * (`src/routes/(app)/dashboard` reports as '/dashboard') — target a group
   * via `files` instead.
   */
  route?: string | string[];
  /** Source-path glob(s) matched against a finding's location, e.g. 'src/routes/(app)/**'. */
  files?: string | string[];
  /** Keys are rule ids ('seo/title-presence') or category names ('seo'). Rule id beats category within an entry. */
  rules: Record<string, RuleSetting>;
}

export interface Config {
  treatDynamicAs: TreatDynamicAs;
  /** Component names treated as meta sources of unknown content (design §11 layer 4). */
  metaComponents: string[];
  /** Per-rule overrides keyed by rule id (design §6). */
  rules: Record<string, RuleSetting>;
  /** Minimum severity that fails the run / CI (design §6). */
  failOn: Severity;
  /** Per-category weights for the combined Health score (default: equal, 1 each) (#10). */
  weights?: Partial<Record<Category, number>>;
  /** Route-/file-scoped rule overrides, applied to results after analysis (later entries win). */
  overrides?: RuleOverride[];
}

export const defaultConfig: Config = {
  treatDynamicAs: 'pass',
  metaComponents: [],
  rules: {},
  failOn: 'critical'
};

/** Merge user config over defaults. Identity helper for config files (design §6). */
export function defineConfig(config: Partial<Config> = {}): Config {
  return { ...defaultConfig, ...config };
}
