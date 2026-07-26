import type { Config, Result, RuleOptions, RuleSetting, Severity } from './types.js';
import type { Rule } from './rule.js';

/** The severity a setting selects: `'off'`, an explicit severity, or undefined (leave the built-in). */
export function settingSeverity(setting: RuleSetting | undefined): Severity | 'off' | undefined {
  if (setting === undefined) return undefined;
  if (typeof setting === 'string') return setting;
  return setting.severity;
}

/** The options a setting carries, or undefined for the string forms. */
export function settingOptions(setting: RuleSetting | undefined): RuleOptions | undefined {
  return setting !== undefined && typeof setting !== 'string' ? setting.options : undefined;
}

/** Drop rules disabled via config (design §6). */
export function selectRules(rules: Rule[], config: Config): Rule[] {
  return rules.filter((rule) => settingSeverity(config.rules[rule.id]) !== 'off');
}

/** Apply per-rule severity overrides to results (design §6). */
export function applyRuleSeverities(results: Result[], config: Config): Result[] {
  return results.map((result) => {
    const severity = settingSeverity(config.rules[result.id]);
    return severity !== undefined && severity !== 'off' ? { ...result, severity } : result;
  });
}

/**
 * Compile a route glob to an anchored RegExp: `*` matches within a segment,
 * `**` across segments, a trailing `/**` also matches the bare prefix, and
 * everything else — including SvelteKit's `(`, `)`, `[`, `]` — is literal
 * (design 2026-07-18).
 */
// '\u0000' below is a placeholder for '**' so the single-'*' pass can't see it;
// it cannot occur in a route id or path, and split/join avoids a control-char regex.
function routeGlobToRegExp(pattern: string): RegExp {
  const body = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .split('\u0000')
    .join('.*');
  const source = body.endsWith('/.*') ? `${body.slice(0, -3)}(/.*)?` : body;
  return new RegExp(`^${source}$`);
}

function toPatterns(globs: string | string[] | undefined): RegExp[] {
  if (globs === undefined) return [];
  return (Array.isArray(globs) ? globs : [globs]).map(routeGlobToRegExp);
}

/**
 * Apply route-/file-scoped overrides to results (design 2026-07-18). An entry
 * matches when any `route` glob matches the finding's route id or any `files`
 * glob matches its location (OR). `'off'` removes a matched result entirely —
 * passing seeds included, so scoring and "checks passed" counts behave as if
 * the rule never ran there. A severity value rewrites the result's severity.
 * Entries are evaluated in order (later entries win); within one entry a
 * rule-id key beats a category key.
 */
export function applyOverrides(results: Result[], config: Config): Result[] {
  const overrides = config.overrides;
  if (!overrides || overrides.length === 0) return results;

  const compiled = overrides.map((o) => ({
    routes: toPatterns(o.route),
    files: toPatterns(o.files),
    rules: o.rules
  }));

  const out: Result[] = [];
  for (const result of results) {
    const { route, location } = result;
    let severity: Severity | 'off' | undefined;
    for (const o of compiled) {
      const matched =
        (route !== undefined && o.routes.some((p) => p.test(route))) ||
        (location !== undefined && o.files.some((p) => p.test(location)));
      if (!matched) continue;
      const s = o.rules[result.id] ?? o.rules[result.category ?? 'seo'];
      // An options-only entry carries no severity — it must not clear one set earlier.
      if (s !== undefined) severity = settingSeverity(s) ?? severity;
    }
    if (severity === undefined) out.push(result);
    else if (severity !== 'off') out.push({ ...result, severity });
  }
  return out;
}
