import { allRules, type RuleOptionsSpec } from '@svelte-vitals/core/internal';

const KNOWN_IDS = new Set(allRules.map((r) => r.id));
const RULE_BY_ID = new Map(allRules.map((r) => [r.id, r]));

/** Rule ids passed to --rules/--ignore that aren't part of the built-in registry. */
export function findUnknownRuleIds(ids: string[]): string[] {
  return [...new Set(ids.filter((id) => !KNOWN_IDS.has(id)))];
}

/** All built-in rule ids, sorted — for help and error messages. */
export function knownRuleIds(): string[] {
  return [...KNOWN_IDS].sort();
}

/** The options a rule declares, or undefined when it takes none. */
export function ruleOptionsSpec(id: string): RuleOptionsSpec | undefined {
  return RULE_BY_ID.get(id)?.options;
}
