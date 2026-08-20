import type { Category, Config, Detection, Fix, Project, Result, Scope, Severity, TreatDynamicAs } from './types.js';
import type { ResolvedHead } from './head.js';
import type { ResolvedImages } from './images.js';
import type { ResolvedHeadings } from './headings.js';
import type { ResolvedA11y } from './a11y.js';
import type { ComponentFacts } from './component.js';
import type { KitModuleFacts } from './kit-module.js';
import type { RuleOptionsSpec } from './rule-options.js';

/** Input given to every rule. Mode-independent: rules see only ResolvedHead[] (design §8, §10). */
export interface RuleContext {
  heads: ResolvedHead[];
  /** Per-route <img> elements for Performance rules (absent in modes that don't collect them). */
  images?: ResolvedImages[];
  /** Per-route page-body headings for seo/single-h1 (absent in modes that don't collect them). */
  headings?: ResolvedHeadings[];
  /** Per-route composed landmark/id occurrences for the route-scoped a11y rules (absent in modes that don't collect them). */
  a11y?: ResolvedA11y[];
  /** Per-file component-body facts for the component-scoped rules (absent in the dev handle's rendered pass). */
  components?: ComponentFacts[];
  /** Per-file SvelteKit route/hooks facts for the kit-module rules (absent in the dev handle's rendered pass). */
  kitModules?: KitModuleFacts[];
  /**
   * Every file under `src/`, as project-relative paths, for directory-shaped Architecture rules
   * (static/CLI + vite build mode only). Sorted — see `collectSourceFiles`, which is what both
   * adapters use to build it.
   */
  sourceFiles?: string[];
  project: Project;
  config: Config;
  /**
   * Report per-declaration counts of places this rule examined. The engine supplies it and keys the
   * result by rule id; a rule that does not call it gets no entry, which is distinct from an entry of
   * zeros. Absent in contexts a caller builds directly. Silent last-write-wins: calling it more than
   * once keeps only the most recent map, with no merge and no error — call it once, with the complete
   * counts, at the end of `check()`.
   */
  recordExamined?: (counts: Record<string, number>) => void;
}

export interface Rule {
  id: string;
  title: string;
  category: Category;
  /** Default severity (overridable by config in later slices). */
  severity: Severity;
  /** 'route' = evaluated per route, 'project' = site-wide, 'component' = evaluated per source file (design §10, §12). */
  scope: Scope;
  /** Why this rule matters — one or two sentences, surfaced by `svelte-vitals explain` (issue #24). */
  rationale: string;
  /** Canonical remediation template, shared by findings and `svelte-vitals explain` (issue #24). */
  fix?: Fix;
  /** Configurable options for this rule; absent means the rule takes none. */
  options?: RuleOptionsSpec;
  /**
   * The message this rule puts on a PASS result. Declared so a PASS synthesised elsewhere — the
   * central inline-suppression pass, which turns a fully-suppressed rule+route into a pass — reads
   * the same as one the rule emitted itself. Rules built through `componentRule` and the a11y
   * route factory supply it; the rest fall back to `title`, which is a cosmetic difference visible
   * only in `--verbose`'s passed listing.
   */
  passLabel?: string;
  /**
   * The rule compares routes against each other (`seo/duplicate-title`), so it cannot be judged
   * from one route's rendered HTML — the dev dashboard's live layer leaves it to the static pass.
   */
  crossRoute?: true;
  /**
   * Evaluate the resolved heads. A single rule may return one Result per route,
   * so it always returns an array. Project-scoped rules return a single element.
   */
  check(ctx: RuleContext): Promise<Result[]>;
}

/** Documentation URL for a rule id. Single source so no per-rule URL can drift (issue #24). */
export function docsUrlFor(id: string): string {
  return `https://oekazuma.github.io/svelte-vitals/rules/${id.toLowerCase()}`;
}

/**
 * Whether a detection should be penalized by scoring (design §12). Shared by the
 * future Scorer and by the Slice 0 reporter so pass/fail is decided in one place.
 *
 *   presence 'none'            → penalized (nothing set anywhere)
 *   value 'absent'             → penalized (tag present but empty)
 *   value 'dynamic'            → penalized when treatDynamicAs is not 'pass' (warn or fail)
 *   otherwise (static/inherited) → not penalized
 */
export function isPenalized(detection: Detection, treatDynamicAs: TreatDynamicAs): boolean {
  if (detection.presence === 'none') return true;
  if (detection.value === 'absent') return true;
  if (detection.value === 'dynamic') return treatDynamicAs !== 'pass';
  return false;
}
