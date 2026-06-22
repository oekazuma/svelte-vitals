import type { Category, Config, Result, Severity } from '../types.js';
import { isPenalized } from '../rule.js';
import { effectiveSeverity } from '../summary.js';

const DEDUCTION: Record<Severity, number> = { critical: 15, warning: 5, info: 1 };
const CRITICAL_CAP = 79;

export interface ScoreModel {
  routeAverage: number;
  sitePenalty: number;
  /** Headline cap value when it actually lowered the score, else null. */
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

  // One deduction per (route, rule id): take the max deduction among duplicates,
  // then sum a route's per-rule deductions. Keyed by a nested map so route paths
  // never need to be parsed back out of a composite string key.
  const routeRuleMax = new Map<string, Map<string, number>>();
  for (const r of routeResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    if (sev === 'critical') anyCritical = true;
    const route = r.route as string;
    let perRule = routeRuleMax.get(route);
    if (!perRule) routeRuleMax.set(route, (perRule = new Map()));
    const prev = perRule.get(r.id) ?? 0;
    if (DEDUCTION[sev] > prev) perRule.set(r.id, DEDUCTION[sev]);
  }
  for (const [route, perRule] of routeRuleMax) {
    let deduction = 0;
    for (const d of perRule.values()) deduction += d;
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

  // The cap is only meaningful when it actually lowers the score; reporting it
  // otherwise reads as "rounded down to 79" even when the score is already below.
  const applyCap = options.applyCriticalCap ?? true;
  const uncapped = routeAverage - sitePenalty;
  const capBinds = applyCap && anyCritical && uncapped > CRITICAL_CAP;
  const criticalCap = capBinds ? CRITICAL_CAP : null;
  const score = capBinds ? CRITICAL_CAP : uncapped;

  return { score: clamp(score), scoreModel: { routeAverage, sitePenalty, criticalCap } };
}

/** Compute an independent score per category present in `results` (issue #10). */
export function scoresByCategory(results: Result[], config: Config): Partial<Record<Category, ScoreResult>> {
  const byCat = new Map<Category, Result[]>();
  for (const r of results) {
    const cat = r.category ?? 'seo';
    let bucket = byCat.get(cat);
    if (!bucket) byCat.set(cat, (bucket = []));
    bucket.push(r);
  }
  const out: Partial<Record<Category, ScoreResult>> = {};
  for (const [cat, rs] of byCat) out[cat] = computeScore(rs, config);
  return out;
}
