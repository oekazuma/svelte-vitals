import { allRules, type RuleSetting } from '@svelte-vitals/core';

interface RuleSelectionInput {
  /** The config file's `rules` map, when a config file was loaded. */
  fileRules?: Record<string, RuleSetting>;
  /**
   * A complete replacement for `fileRules` — what the Vite plugin and programmatic callers pass.
   * Whole-field, per the per-field precedence every other config field follows.
   */
  rules?: Record<string, RuleSetting>;
  /** `--rules`: run only these rule ids. Selection, not configuration. */
  allowRules?: string[];
  /** `--ignore`: silence these rule ids. Selection, not configuration. */
  ignoreRules?: string[];
}

/**
 * The `rules` map a run is analyzed with.
 *
 * A flag says *which* rules run; the config file says *how* they run. `'off'` is the only setting
 * that is purely selection, so it is the only one a flag overrides — a severity or an options map
 * is configuration and survives `--rules` naming its rule. That is what selection encoded as the
 * *absence* of an entry could not express: the one slot had to mean both "no entry, so enabled"
 * and "an entry, so configured" (design 2026-08-06).
 *
 * `ignoreRules` is applied last. Applying it before the allow-list rewrite would let the
 * force-enable delete resurrect a rule `--ignore` named.
 *
 * Ids are taken as given. **An id in `allowRules` that no registered rule matches turns every rule
 * off**, so callers owe `findUnknownRuleIds` first; the CLI does this fatally in `resolve-args`.
 */
export function resolveRuleSelection(input: RuleSelectionInput): Record<string, RuleSetting> {
  const out: Record<string, RuleSetting> = { ...(input.rules ?? input.fileRules) };

  const allow = input.allowRules ?? [];
  if (allow.length > 0) {
    const allowed = new Set(allow);
    for (const rule of allRules) if (!allowed.has(rule.id)) out[rule.id] = 'off';
    for (const id of allowed) {
      const setting = out[id];
      if (setting === undefined) continue;
      if (setting === 'off') {
        delete out[id];
      } else if (typeof setting === 'object' && setting.severity === 'off') {
        const { severity: _forceEnabled, ...rest } = setting;
        // An object that carried nothing but `severity: 'off'` has no configuration left to keep.
        if (Object.keys(rest).length === 0) delete out[id];
        else out[id] = rest;
      }
    }
  }

  for (const id of input.ignoreRules ?? []) out[id] = 'off';
  return out;
}
