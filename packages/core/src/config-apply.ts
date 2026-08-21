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

/**
 * A rule's effective severity under `config`, or undefined when it is off. The one place the
 * defaultOff decision lives: a `defaultOff` rule with no `config.rules` entry is off — an
 * explicit entry (any severity, or an options object) is the only enablement path.
 */
export function configuredSeverity(rule: Rule, config: Config): Severity | undefined {
  const setting = config.rules[rule.id];
  if (setting === undefined) return rule.defaultOff ? undefined : rule.severity;
  const severity = settingSeverity(setting);
  if (severity === 'off') return undefined;
  return severity ?? rule.severity;
}

/** Drop rules disabled via config (design §6), including a `defaultOff` rule with no entry. */
export function selectRules(rules: Rule[], config: Config): Rule[] {
  return rules.filter((rule) => configuredSeverity(rule, config) !== undefined);
}

/**
 * `config` with `failedRuleIds` (from `runRules`' `failedRules`) forced `'off'`: a rule that threw
 * examined nothing, so leaving it in the inventory would score it as if it had run clean, silently
 * inflating Health. Reuses the exact mechanism a `rules: { id: 'off' }` config entry already gets —
 * `selectRules`/`buildInventory` both drop an `'off'` id from the denominator — rather than adding a
 * second, parallel notion of "not counted" for callers to keep in sync.
 */
export function withFailedRulesOff(config: Config, failedRuleIds: readonly string[]): Config {
  if (failedRuleIds.length === 0) return config;
  return {
    ...config,
    rules: {
      ...config.rules,
      ...Object.fromEntries(failedRuleIds.map((id): [string, RuleSetting] => [id, 'off']))
    }
  };
}

/** One-line "rule failed and was skipped" warning; capped to the message's first line so a stack trace can't flood a terminal. */
export function formatFailedRuleWarning(f: { id: string; message: string }): string {
  return `rule ${f.id} failed and was skipped: ${f.message.split('\n')[0]}`;
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
 * (design 2026-07-18). Paths are matched relative to the analyzed project's
 * root (the cwd svelte-vitals runs from), not necessarily a repo root.
 *
 * Exported (module-internal to `@svelte-vitals/core`, not part of the package's public
 * barrel — nothing outside `packages/core` consumes it) so a rule that matches paths
 * against user globs (`architecture/private-scope-import`, `architecture/route-component-import`)
 * compiles them with the same semantics as `route`/`files` overrides, rather than a second
 * implementation that could drift.
 */
// '\u0000' below is a placeholder for '**' so the single-'*' pass can't see it;
// it cannot occur in a route id or path, and split/join avoids a control-char regex.
export function routeGlobToRegExp(pattern: string): RegExp {
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

/** An override entry with its globs compiled once. Build with `compileOverrides`. */
export interface CompiledOverride {
  routes: RegExp[];
  files: RegExp[];
  rules: Record<string, RuleSetting>;
}

/**
 * Compile every override entry's globs to RegExp, once. Callers that match many
 * targets (every component, every route) must hoist this out of their loop.
 */
export function compileOverrides(config: Config): CompiledOverride[] {
  return (config.overrides ?? []).map((o) => ({
    routes: toPatterns(o.route),
    files: toPatterns(o.files),
    rules: o.rules
  }));
}

/**
 * Whether an override entry applies to a target. THE single definition of that
 * question — the result post-pass and in-run option resolution both call it.
 * Sharing this matcher is necessary but not sufficient for a severity override
 * and an option override to select the same files: each caller must also pass
 * the same `target` (route and, critically, `file`) the other path effectively
 * matches against. See Finding 1, docs/superpowers/specs/2026-07-26-rule-options-design.md.
 */
export function overrideMatches(o: CompiledOverride, target: { route?: string; file?: string }): boolean {
  const { route, file } = target;
  return (
    (route !== undefined && o.routes.some((p) => p.test(route))) ||
    (file !== undefined && o.files.some((p) => p.test(file)))
  );
}

/**
 * Apply route-/file-scoped overrides to results (design 2026-07-18). An entry
 * matches when any `route` glob matches the finding's route id or any `files`
 * glob matches its location (OR). `'off'` removes a matched result entirely —
 * passing seeds included, so scoring and "checks passed" counts behave as if
 * the rule never ran there. A severity value rewrites the result's severity.
 * Entries are evaluated in order (later entries win); within one entry, a
 * rule-id key beats a category key only when it specifies a `severity` — an
 * options-only rule-id key (no `severity`) contributes its options but leaves
 * the category key's severity in force, rather than shadowing it (design
 * 2026-07-26, Finding 2 / second review Finding E).
 */
export function applyOverrides(results: Result[], config: Config): Result[] {
  const compiled = compileOverrides(config);
  if (compiled.length === 0) return results;

  const out: Result[] = [];
  for (const result of results) {
    let severity: Severity | 'off' | undefined;
    for (const o of compiled) {
      if (!overrideMatches(o, { route: result.route, file: result.location })) continue;
      // Rule id and category are resolved independently: with the object form, a
      // rule-id key can exist while carrying no severity (options-only), and must
      // not shadow a category key that does (Finding 2, design doc as above).
      const sev = settingSeverity(o.rules[result.id]) ?? settingSeverity(o.rules[result.category ?? 'seo']);
      if (sev !== undefined) severity = sev;
    }
    if (severity === undefined) out.push(result);
    else if (severity !== 'off') out.push({ ...result, severity });
  }
  return out;
}
