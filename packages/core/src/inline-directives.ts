import type { Result } from './types.js';
import type { SuppressionDirective } from './component.js';

/** File-relative-path → the inline directives collected from that file. */
export type DirectiveIndex = ReadonlyMap<string, readonly SuppressionDirective[]>;

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
 * suppressed result in emission order — the anchor the rules themselves use.
 */
export function applyInlineDirectives(
  results: readonly Result[],
  index: DirectiveIndex,
  passLabelOf: (ruleId: string) => string,
  penalized: (r: Result) => boolean
): Result[] {
  const kept: Result[] = [];
  /** rule+route → the first suppressed result, for the PASS this pair may need. */
  const silenced = new Map<string, Result>();
  const survived = new Set<string>();

  for (const r of results) {
    if (!penalized(r)) {
      kept.push(r);
      continue;
    }
    const key = `${r.id} ${r.route ?? ''}`;
    const line = r.line;
    const hit =
      r.location !== undefined &&
      line !== undefined &&
      line > 0 &&
      (index.get(r.location) ?? []).some((d) => d.line === line && (!d.ruleIds || d.ruleIds.includes(r.id)));
    if (hit) {
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
      message: passLabelOf(r.id)
    });
  }
  return kept;
}
