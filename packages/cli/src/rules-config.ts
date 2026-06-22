import { allRules, type RuleSetting } from '@svelte-vitals/core';

const KNOWN_IDS = new Set(allRules.map((r) => r.id));

/** Prefix of every Svelte compiler a11y warning code (Accessibility category, #10). */
export const A11Y_CODE_PREFIX = 'a11y_';

/**
 * Internal sentinel key written into the rules map to suppress the whole
 * Accessibility category (see buildRulesConfig). It shares the rules-map
 * namespace but is not a user-settable rule id — findUnknownRuleIds rejects it.
 *
 * NOTE (#10): this is a deliberate stopgap. The v0.6 follow-up replaces it with a
 * typed per-category config so category toggles no longer ride the rules map.
 */
export const A11Y_CATEGORY_KEY = 'a11y_category';

/** Rule ids passed to --rules/--ignore that aren't part of the built-in registry. */
export function findUnknownRuleIds(ids: string[]): string[] {
  // a11y_* ids are Svelte compiler warning codes (Accessibility category, #10);
  // they are accepted dynamically rather than enumerated in the built-in registry.
  // The internal a11y_category sentinel is NOT user-settable, so it stays "unknown".
  return [
    ...new Set(ids.filter((id) => !KNOWN_IDS.has(id) && !(id.startsWith(A11Y_CODE_PREFIX) && id !== A11Y_CATEGORY_KEY)))
  ];
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
 *
 * When the allow-list is non-empty and contains no `a11y_*` entries, the
 * `A11Y_CATEGORY_KEY` sentinel is set to `'off'`; `collectA11y` checks this key
 * to suppress the entire Accessibility category.
 */
export function buildRulesConfig(allow: string[], ignore: string[]): Record<string, RuleSetting> {
  const rules: Record<string, RuleSetting> = {};
  if (allow.length > 0) {
    for (const r of allRules) if (!allow.includes(r.id)) rules[r.id] = 'off';
    // If the allow-list contains no a11y codes, suppress the Accessibility category.
    if (!allow.some((id) => id.startsWith(A11Y_CODE_PREFIX))) rules[A11Y_CATEGORY_KEY] = 'off';
  }
  for (const id of ignore) rules[id] = 'off';
  return rules;
}
