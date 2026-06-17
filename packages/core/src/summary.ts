import type { Config, Result, Severity } from './types.js';
import { isPenalized } from './rule.js';

export interface Summary {
  critical: number;
  warning: number;
  info: number;
  /** Passed (not penalized), including dynamic. */
  passed: number;
  /** Subset of passed that resolved dynamically (↯). */
  dynamic: number;
}

/** Classify a single result for display/scoring (design §7, §12). */
export type Classification = 'fail' | 'pass' | 'dynamic';

export function classify(result: Result, config: Config): Classification {
  if (isPenalized(result.detection, config.treatDynamicAs)) return 'fail';
  if (result.detection.value === 'dynamic') return 'dynamic';
  return 'pass';
}

export function summarize(results: Result[], config: Config): Summary {
  const summary: Summary = { critical: 0, warning: 0, info: 0, passed: 0, dynamic: 0 };
  for (const result of results) {
    const cls = classify(result, config);
    if (cls === 'fail') {
      summary[severityKey(result.severity)] += 1;
    } else {
      summary.passed += 1;
      if (cls === 'dynamic') summary.dynamic += 1;
    }
  }
  return summary;
}

/** Whether the run should fail the build/CI per the minimum failing severity. */
export function hasFailureAtOrAbove(summary: Summary, min: Severity): boolean {
  const order: Severity[] = ['info', 'warning', 'critical'];
  const threshold = order.indexOf(min);
  return order.some((sev, idx) => idx >= threshold && summary[severityKey(sev)] > 0);
}

function severityKey(severity: Severity): 'critical' | 'warning' | 'info' {
  return severity;
}
