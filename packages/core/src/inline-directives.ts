import { isPenalized, type Rule } from './rule.js';
import type { Config, Result } from './types.js';
import type { SuppressionDirective } from './component.js';

/** File-relative-path → the inline directives collected from that file. */
export type DirectiveIndex = ReadonlyMap<string, readonly SuppressionDirective[]>;

/** The directive silencing `r`, if one sits on its line and names its rule (or names nothing). */
function directiveFor(index: DirectiveIndex, r: Result): SuppressionDirective | undefined {
  const line = r.line;
  if (r.location === undefined || line === undefined || line <= 0) return undefined;
  return (index.get(r.location) ?? []).find((d) => d.line === line && (!d.ruleIds || d.ruleIds.includes(r.id)));
}

/**
 * Apply inline `svelte-vitals-disable-next-line` directives to a finished result set — one
 * mechanism, over `Result`s, so any rule that emits a line-anchored finding is covered by
 * construction rather than by per-family wiring (design 2026-08-17).
 *
 * Runs on the output of `applyOverrides(applyRuleSeverities(...))`, so a directive silences
 * whatever survived config, and every consumer downstream — scoring, `--fail-on`, the suppressions
 * file, the reporters — sees the same suppressed set. `fileRule` keeps its own earlier filter and
 * is unaffected: a result it already suppressed never arrives here, and its PASS is not penalized.
 *
 * A rule+route whose every penalized result was suppressed gains one PASS, located at the first
 * suppressed result in emission order — the anchor the rules themselves use. Its message is the
 * rule's `passLabel` when it declares one, else its `title`.
 */
export function applyInlineDirectives(
  results: readonly Result[],
  index: DirectiveIndex,
  rules: readonly Rule[],
  config: Config
): Result[] {
  const labels = new Map(rules.map((r) => [r.id, r.passLabel ?? r.title]));
  const kept: Result[] = [];
  /** rule+route → the first suppressed result, for the PASS this pair may need. */
  const silenced = new Map<string, Result>();
  const survived = new Set<string>();

  for (const r of results) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) {
      kept.push(r);
      continue;
    }
    const key = `${r.id} ${r.route ?? ''}`;
    if (directiveFor(index, r) !== undefined) {
      if (!silenced.has(key)) silenced.set(key, r);
      continue;
    }
    survived.add(key);
    kept.push(r);
  }

  for (const [key, r] of silenced) {
    if (survived.has(key)) continue;
    kept.push({
      id: r.id,
      ...(r.category ? { category: r.category } : {}),
      severity: r.severity,
      detection: { presence: 'own', value: 'static' },
      ...(r.route !== undefined ? { route: r.route } : {}),
      ...(r.location !== undefined ? { location: r.location } : {}),
      message: labels.get(r.id) ?? r.id
    });
  }
  return kept;
}

/**
 * Directives that silenced nothing, for `--report-unused-directives`. Off by default: the author
 * fixed the code and left the comment, the rule is off in config, the run was scoped — all
 * legitimate, and reporting them by default is how a warning gets muted.
 *
 * Takes the results as they stood **before** suppression, and judges a directive across every
 * route at once, since one directive in a shared component serves all of them.
 */
export function unusedDirectives(penalizedResults: readonly Result[], index: DirectiveIndex, config: Config): string[] {
  const used = new Set<SuppressionDirective>();
  for (const r of penalizedResults) {
    if (!isPenalized(r.detection, config.treatDynamicAs)) continue;
    const d = directiveFor(index, r);
    if (d) used.add(d);
  }
  const out: string[] = [];
  for (const [file, directives] of index) {
    for (const d of directives) {
      if (!used.has(d)) out.push(`${file}:${d.line - 1} suppresses nothing`);
    }
  }
  return out.sort();
}

/**
 * Directives naming a rule id that no rule declares. Unlike a directive that matches no finding —
 * legitimate whenever the code was fixed, the rule turned off, or the run scoped — a misspelled id
 * can never be right, so it is reported rather than silently suppressing nothing.
 *
 * Compared against every registered rule, not the selected ones: disabling a rule in config must
 * not turn its directives into errors.
 */
export function unknownDirectiveIds(index: DirectiveIndex, rules: readonly Rule[]): string[] {
  const known = new Set(rules.map((r) => r.id));
  const seen = new Set<string>();
  for (const [file, directives] of index) {
    for (const d of directives) {
      for (const id of d.ruleIds ?? []) {
        if (!known.has(id)) seen.add(`${file}:${d.line - 1} disables unknown rule "${id}"`);
      }
    }
  }
  return [...seen].sort();
}
