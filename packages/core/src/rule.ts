import type { Category, Config, Detection, Fix, Project, Result, Scope, Severity, TreatDynamicAs } from './types.js';
import type { ResolvedHead } from './head.js';
import type { ResolvedImages } from './images.js';
import type { ResolvedHeadings } from './headings.js';
import type { ComponentFacts } from './component.js';
import type { KitModuleFacts } from './kit-module.js';

/** Input given to every rule. Mode-independent: rules see only ResolvedHead[] (design §8, §10). */
export interface RuleContext {
  heads: ResolvedHead[];
  /** Per-route <img> elements for Performance rules (absent in modes that don't collect them). */
  images?: ResolvedImages[];
  /** Per-route page-body headings for seo/single-h1 (absent in modes that don't collect them). */
  headings?: ResolvedHeadings[];
  /** Per-file component-body facts for Correctness rules (static/CLI mode only). */
  components?: ComponentFacts[];
  /** Per-file SvelteKit route/hooks facts for the SSR shared-state rules (static/CLI + vite build mode only). */
  kitModules?: KitModuleFacts[];
  project: Project;
  config: Config;
}

export interface Rule {
  id: string;
  title: string;
  category: Category;
  /** Default severity (overridable by config in later slices). */
  severity: Severity;
  /** 'route' = evaluated per route, 'project' = site-wide (design §10, §12). */
  scope: Scope;
  /** Why this rule matters — one or two sentences, surfaced by explain_rule (issue #24). */
  rationale: string;
  /** Canonical remediation template, shared by findings and explain_rule (issue #24). */
  fix?: Fix;
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
