import { allRules, type RuleOptionsSpec } from '@svelte-vitals/core/internal';
import { readCoreVersion, readPackageVersion } from './version.js';

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

/**
 * Stamps the rule registry's provenance onto error messages that list known ids.
 * Two copies of svelte-vitals can coexist in one tree (e.g. the Vite plugin's
 * resolved copy and a directly installed CLI, issue #583); without the versions,
 * a rule that exists in one copy but not the other reads as a mystery rather
 * than a version skew.
 */
export function registryTag(): string {
  return `svelte-vitals ${readPackageVersion()}, core ${readCoreVersion()}`;
}
