import type { Category, Config, Detection, Result, Scope, Severity, TreatDynamicAs } from './types.js';
import type { ResolvedHead } from './head.js';

/** Input given to every rule. Mode-independent: rules see only ResolvedHead[] (design §8, §10). */
export interface RuleContext {
  heads: ResolvedHead[];
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
  /**
   * Evaluate the resolved heads. A single rule may return one Result per route,
   * so it always returns an array. Project-scoped rules return a single element.
   */
  check(ctx: RuleContext): Promise<Result[]>;
}

/**
 * Whether a detection should be penalized by scoring (design §12). Shared by the
 * future Scorer and by the Slice 0 reporter so pass/fail is decided in one place.
 *
 *   presence 'none'            → penalized (nothing set anywhere)
 *   value 'absent'             → penalized (tag present but empty)
 *   value 'dynamic'            → penalized only when treatDynamicAs is 'fail'
 *   otherwise (static/inherited) → not penalized
 */
export function isPenalized(detection: Detection, treatDynamicAs: TreatDynamicAs): boolean {
  if (detection.presence === 'none') return true;
  if (detection.value === 'absent') return true;
  if (detection.value === 'dynamic') return treatDynamicAs === 'fail';
  return false;
}
