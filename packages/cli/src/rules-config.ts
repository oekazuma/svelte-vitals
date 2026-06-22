import { allRules, type RuleSetting } from '@svelte-vitals/core';

const KNOWN_IDS = new Set(allRules.map((r) => r.id));

/** Rule ids passed to --rules/--ignore that aren't part of the built-in registry. */
export function findUnknownRuleIds(ids: string[]): string[] {
  // a11y_* ids are Svelte compiler warning codes (Accessibility category, #10);
  // they are accepted dynamically rather than enumerated in the built-in registry.
  return [...new Set(ids.filter((id) => !KNOWN_IDS.has(id) && !id.startsWith('a11y')))];
}

/** All built-in rule ids, sorted — for help and error messages. */
export function knownRuleIds(): string[] {
  return [...KNOWN_IDS].sort();
}

/**
 * Build the per-rule config map from an allow-list (--rules) and a deny-list
 * (--ignore). An allow-list disables every rule not listed; deny always wins.
 * Callers should reject unknown ids first (see findUnknownRuleIds) so a typo in
 * --rules can't silently disable every rule.
 */
export function buildRulesConfig(allow: string[], ignore: string[]): Record<string, RuleSetting> {
  const rules: Record<string, RuleSetting> = {};
  if (allow.length > 0) {
    for (const r of allRules) if (!allow.includes(r.id)) rules[r.id] = 'off';
  }
  for (const id of ignore) rules[id] = 'off';
  return rules;
}
