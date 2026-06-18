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

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Compute the headline score and its breakdown (design §12). */
export function computeScore(results: Result[], config: Config): ScoreResult {
  const routeResults = results.filter((r) => r.route !== undefined);
  const projectResults = results.filter((r) => r.route === undefined);

  // Seed every route at 100 so passing routes count toward the average.
  const routeScores = new Map<string, number>();
  for (const r of routeResults) if (!routeScores.has(r.route as string)) routeScores.set(r.route as string, 100);

  let anyCritical = false;
  for (const r of routeResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    routeScores.set(r.route as string, (routeScores.get(r.route as string) as number) - DEDUCTION[sev]);
    if (sev === 'critical') anyCritical = true;
  }

  const scores = [...routeScores.values()].map(clamp);
  const routeAverage = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

  let sitePenalty = 0;
  for (const r of projectResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    sitePenalty += DEDUCTION[sev];
    if (sev === 'critical') anyCritical = true;
  }

  const criticalCap = anyCritical ? CRITICAL_CAP : null;
  let score = routeAverage - sitePenalty;
  if (criticalCap !== null) score = Math.min(score, criticalCap);

  return { score: clamp(score), scoreModel: { routeAverage, sitePenalty, criticalCap } };
}
