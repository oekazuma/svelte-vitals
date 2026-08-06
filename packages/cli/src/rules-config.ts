import { allRules, type RuleOptionsSpec, type RuleSetting } from '@svelte-vitals/core';

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
 * Build the per-rule config map from an allow-list (--rules) and a deny-list
 * (--ignore). An allow-list disables every rule not listed; deny always wins.
 * Callers should reject unknown ids first (see findUnknownRuleIds) so a typo in
 * --rules can't silently disable every rule.
 *
 * No longer used by the CLI: `resolve-args` passes `--rules`/`--ignore` as id lists and
 * `rule-selection.ts` composes the map (design 2026-08-06-rule-selection-design.md). The CLI
 * used to call this with `ignore` empty and hand the result to `AnalyzeOptions.rules`, which
 * replaces a config file's `rules` map as a whole (design 2026-07-05-config-file-design.md §3)
 * — correct for --rules's allow-list semantics under that encoding, but not for --ignore, which
 * names only the rule(s) it silences and must layer onto the file's map instead. Kept as
 * exported API: a direct caller building a `rules` value from both an allow- and a deny-list on
 * purpose gets exactly that whole-field replacement.
 */
export function buildRulesConfig(allow: string[], ignore: string[]): Record<string, RuleSetting> {
  const rules: Record<string, RuleSetting> = {};
  if (allow.length > 0) {
    for (const r of allRules) if (!allow.includes(r.id)) rules[r.id] = 'off';
  }
  for (const id of ignore) rules[id] = 'off';
  return rules;
}
