import type { JsonReport, ResolvedA11y } from '@svelte-vitals/core/internal';

export const ID_REF_RULE = 'a11y/no-missing-id-ref';

export type SkippedRouteEntry = NonNullable<JsonReport['skipped']>[string][number];

/** One entry per analyzed route whose closed world failed; sorted for stable report output. */
export function buildIdRefSkips(a11y: readonly ResolvedA11y[]): SkippedRouteEntry[] {
  return a11y
    .filter((r) => !r.fullyResolved)
    .map((r) => ({ route: r.route, refs: r.idRefs.length, causes: r.unresolvedCauses ?? [] }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

// Fixed order; a kind no skipped route carries is omitted. Counts are routes-carrying-the-kind,
// so they overlap and do not sum to the skipped total (spec: "Reporting").
const KIND_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['component', 'unresolved component'],
  ['spread', 'spread'],
  ['html', '{@html}'],
  ['dynamic-id', 'dynamic id']
];

export function idRefSkipWarning(entries: readonly SkippedRouteEntry[], analyzedRoutes: number): string {
  const parts: string[] = [];
  for (const [kind, label] of KIND_LABELS) {
    const n = entries.filter((e) => e.causes.some((c) => c.kind === kind)).length;
    if (n > 0) parts.push(`${label} ${n}`);
  }
  return (
    `${ID_REF_RULE} skipped ${entries.length} of ${analyzedRoutes} analyzed route(s) ` +
    `(${parts.join(', ')} — per-route detail in the JSON report's "skipped").`
  );
}
