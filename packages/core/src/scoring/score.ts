import type { Config, Result, Severity } from '../types.js';
import { isPenalized } from '../rule.js';
import { effectiveSeverity } from '../summary.js';

const DEDUCTION: Record<Severity, number> = { critical: 15, warning: 5, info: 1 };
const CRITICAL_CAP = 79;

export interface ScoreModel {
  routeAverage: number;
  sitePenalty: number;
  /** Headline cap applied when a critical finding exists, else null. */
  criticalCap: number | null;
}

export interface ScoreResult {
  score: number;
  scoreModel: ScoreModel;
}

export interface ScoreOptions {
  applyCriticalCap?: boolean;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Compute the headline score and its breakdown (design §12). */
export function computeScore(results: Result[], config: Config, options: ScoreOptions = {}): ScoreResult {
  const routeResults = results.filter((r) => r.route !== undefined);
  const projectResults = results.filter((r) => r.route === undefined);

  // Seed every route at 100 so passing routes count toward the average.
  const routeScores = new Map<string, number>();
  for (const r of routeResults) if (!routeScores.has(r.route as string)) routeScores.set(r.route as string, 100);

  let anyCritical = false;

  // One deduction per (route, rule id): take the max deduction among duplicates.
  const routeRuleMax = new Map<string, number>();
  for (const r of routeResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    if (sev === 'critical') anyCritical = true;
    const key = `${r.route as string} ${r.id}`;
    const prev = routeRuleMax.get(key) ?? 0;
    if (DEDUCTION[sev] > prev) routeRuleMax.set(key, DEDUCTION[sev]);
  }
  for (const [key, deduction] of routeRuleMax) {
    const route = key.slice(0, key.lastIndexOf(' '));
    routeScores.set(route, (routeScores.get(route) as number) - deduction);
  }

  const scores = [...routeScores.values()].map(clamp);
  const routeAverage = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

  // One deduction per project rule id: take the max deduction among duplicates.
  const projectRuleMax = new Map<string, number>();
  for (const r of projectResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    if (sev === 'critical') anyCritical = true;
    const prev = projectRuleMax.get(r.id) ?? 0;
    if (DEDUCTION[sev] > prev) projectRuleMax.set(r.id, DEDUCTION[sev]);
  }
  let sitePenalty = 0;
  for (const deduction of projectRuleMax.values()) sitePenalty += deduction;

  const applyCap = options.applyCriticalCap ?? true;
  const criticalCap = applyCap && anyCritical ? CRITICAL_CAP : null;
  let score = routeAverage - sitePenalty;
  if (criticalCap !== null) score = Math.min(score, criticalCap);

  return { score: clamp(score), scoreModel: { routeAverage, sitePenalty, criticalCap } };
}
