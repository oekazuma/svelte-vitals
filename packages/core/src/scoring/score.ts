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
  /** The score as displayed: `Math.floor(rawScore)`, so 100 means the deduction was exactly zero. */
  score: number;
  /**
   * The same score before flooring, after `sitePenalty` and the cap, clamped to `[0, 100]`. Exposed so
   * `computeHealth` can average unrounded values and floor once — averaging the displayed scores would
   * compose two roundings and move Health by up to two points.
   */
  rawScore: number;
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
  const rawRouteAverage = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;
  // No such treatment needed here (contrast computeHealth below, which works in deficit space and caps
  // at 99 rather than trusting the arithmetic): every route score is an integer, so `sum / length` is a
  // division of exact integers, and whenever the true quotient IS an integer it is exactly representable
  // — this mean can never come out as 99.99999999999999.
  const routeAverage = Math.floor(rawRouteAverage);

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

  // The cap is decided on the RAW value. Deciding it on the floored mean would let a capped category
  // contribute nearly a point above the cap to Health — the displayed score cannot disagree either way,
  // since that would need `rawRouteAverage - Math.floor(rawRouteAverage) > 1`.
  const applyCap = options.applyCriticalCap ?? true;
  const rawUncapped = rawRouteAverage - sitePenalty;
  const capBinds = applyCap && anyCritical && rawUncapped > CRITICAL_CAP;
  const criticalCap = capBinds ? CRITICAL_CAP : null;
  const rawScore = clamp(capBinds ? CRITICAL_CAP : rawUncapped);

  return { score: Math.floor(rawScore), rawScore, scoreModel: { routeAverage, sitePenalty, criticalCap } };
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

export interface HealthResult {
  /** Weighted overall score across present categories (0–100). */
  health: number;
  categories: Partial<Record<Category, ScoreResult>>;
  /** Effective weight used per present category. */
  weights: Partial<Record<Category, number>>;
}

/** Combined weighted Health score over the categories present in `results` (#10). */
export function computeHealth(results: Result[], config: Config): HealthResult {
  const categories = scoresByCategory(results, config);
  const weights: Partial<Record<Category, number>> = {};
  let weightedDeficit = 0;
  let total = 0;
  for (const cat of Object.keys(categories) as Category[]) {
    const w = config.weights?.[cat] ?? 1;
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`invalid weight for '${cat}'; expected a finite number >= 0.`);
    }
    weights[cat] = w;
    weightedDeficit += (100 - categories[cat]!.rawScore) * w;
    total += w;
  }
  // No present categories (e.g. no results) → perfect 100, consistent with computeScore's empty → 100.
  if (Object.keys(weights).length === 0) return { health: 100, categories, weights };
  // Present categories but all weights zero → no meaningful weighted average; a silent 100
  // here would mask real findings (e.g. let a --min-health gate pass), so reject it.
  if (total === 0) {
    throw new RangeError('Health weights sum to 0; at least one present category must have a positive weight.');
  }
  // Average the DEFICIT (100 - rawScore), not the score, and floor by subtracting it from 100. This
  // removes the epsilon guard an earlier version needed here: that guard assumed "the smallest real
  // difference is 1/N" — true only for comparable weights. `config.weights` accepts any finite
  // non-negative value, so a weight can be made arbitrarily small (e.g. 1e-12), making the true quotient
  // arbitrarily close to — but strictly below — 100 while still failing any fixed epsilon. Deficit space
  // sidesteps the problem instead of tuning around it: with no findings, every category's rawScore is
  // exactly 100 (integer route scores average exactly, sitePenalty is 0), so every term is `0 * w === 0`
  // and the sum is exactly 0 — no tolerance needed to recognize a clean project. `Math.min(99, …)` then
  // makes "any finding means at most 99" structural rather than arithmetic: it catches a deficit so small
  // that `100 - deficit` would round back to 100 in floating point, which is the exact case the epsilon
  // used to paper over, now handled without one.
  const averageDeficit = weightedDeficit / total;
  const health = averageDeficit === 0 ? 100 : Math.min(99, Math.floor(100 - averageDeficit));
  return { health, categories, weights };
}
