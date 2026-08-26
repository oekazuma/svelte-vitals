import type { Category, Config, Result } from '../types.js';
import type { Rule } from '../rule.js';
import { isPenalized } from '../rule.js';
import { effectiveSeverity } from '../summary.js';
import { selectRules } from '../config-apply.js';
import { allRules } from '../rules/index.js';
import { buildInventory, ruleScopes, DEDUCTION, type PairKey } from './inventory.js';

const CRITICAL_CAP = 79;

/**
 * A key is never scored against less than this much severity weight. Without it a pair holding one rule
 * makes that rule's finding cost the whole key, and a finding's cost stops tracking its severity — an
 * `info` in an eight-rule pair outweighed a `warning` in a twenty-six-rule one. It also makes the
 * denominator provably non-zero, which is why the division below needs no zero-guard of its own —
 * a floor lowered below 1 would bring that guard back.
 */
export const INVENTORY_FLOOR = 25;

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
  /** Keys this result set touched. */
  keys: number;
  /** Keys carrying at least one penalized finding. */
  affectedKeys: number;
}

export interface ScoreOptions {
  applyCriticalCap?: boolean;
  /** The rules that ran. Defaults to the selected registry; supplied by tests and custom rule sets. */
  rules?: readonly Rule[];
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Compute the headline score and its breakdown (design §12). */
export function computeScore(results: Result[], config: Config, options: ScoreOptions = {}): ScoreResult {
  const routeResults = results.filter((r) => r.route !== undefined);
  const projectResults = results.filter((r) => r.route === undefined);

  // `selectRules` applied here, not just inside `buildInventory`, so `pairOf` and the inventory see
  // the same filtered list — an injected rule that config turns `off` must vanish from both, not map
  // to a pair in one and contribute nothing in the other.
  const rules = selectRules([...(options.rules ?? allRules)], config);
  const inventory = buildInventory(config, rules);
  const pairOf = ruleScopes(rules);

  let anyCritical = false;

  // Per key: the pairs it was measured against, and the weight that failed. One deduction per
  // (key, rule id) — the max among duplicates — exactly as before; only the divisor is new.
  const observed = new Map<string, Set<PairKey>>();
  const ruleMax = new Map<string, Map<string, number>>();
  for (const r of routeResults) {
    const key = r.route as string;
    if (!observed.has(key)) observed.set(key, new Set());
    const pair = pairOf.get(r.id);
    if (pair !== undefined) observed.get(key)!.add(pair);
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const sev = effectiveSeverity(r, config);
    if (sev === 'critical') anyCritical = true;
    let perRule = ruleMax.get(key);
    if (!perRule) ruleMax.set(key, (perRule = new Map()));
    const prev = perRule.get(r.id) ?? 0;
    if (DEDUCTION[sev] > prev) perRule.set(r.id, DEDUCTION[sev]);
  }

  // Deficit space, as `computeHealth` already works: a mean of key scores computes
  // 49.99999999999999 for a true 50 on two keys of deficit 1000/28 and 1800/28.
  let affectedKeys = 0;
  let totalDeficit = 0;
  for (const [key, pairs] of observed) {
    let failed = 0;
    for (const d of ruleMax.get(key)?.values() ?? []) failed += d;
    if (failed > 0) affectedKeys += 1;
    let inventoryWeight = 0;
    // `pairOf` and `inventory` are built from the same filtered `rules`, so every pair reachable
    // through `pairOf` also has an inventory entry; the `?? 0` is a degrade-to-0-not-NaN fallback
    // against a future divergence between the two, not a path this file's own inputs can reach.
    for (const p of pairs) inventoryWeight += inventory.get(p) ?? 0;
    // `max` keeps `failed` from exceeding its own denominator, so a penalized finding can never still
    // score 100: the two ways that would happen are `treatDynamicAs: 'warn'` promoting a result's
    // severity above its rule's, and a result whose rule is absent from the inventory. The
    // `INVENTORY_FLOOR` guard keeps a small pair from making one finding cost the whole key.
    inventoryWeight = Math.max(inventoryWeight, failed, INVENTORY_FLOOR);
    // `100 - (100 * f) / i`, never `100 * (1 - f / i)`: the latter gives 19.999999999999996 for
    // f = 88, i = 110 and displays 19 for a true 20.
    totalDeficit += (100 * failed) / inventoryWeight;
  }

  const keyCount = observed.size;
  const rawRouteAverage = keyCount === 0 ? 100 : 100 - totalDeficit / keyCount;
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

  return {
    score: Math.floor(rawScore),
    rawScore,
    scoreModel: { routeAverage, sitePenalty, criticalCap },
    keys: keyCount,
    affectedKeys
  };
}

/** Compute an independent score per category present in `results` (issue #10). */
export function scoresByCategory(results: Result[], config: Config, options: ScoreOptions = {}) {
  const byCat = new Map<Category, Result[]>();
  for (const r of results) {
    const cat = r.category ?? 'seo';
    let bucket = byCat.get(cat);
    if (!bucket) byCat.set(cat, (bucket = []));
    bucket.push(r);
  }
  const out: Partial<Record<Category, ScoreResult>> = {};
  for (const [cat, rs] of byCat) out[cat] = computeScore(rs, config, options);
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
