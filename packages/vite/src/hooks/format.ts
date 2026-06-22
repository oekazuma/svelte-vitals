import { isPenalized, effectiveSeverity, type Config, type Result, type Severity } from '@svelte-vitals/core';

const GLYPH: Record<Severity, string> = { critical: '✗', warning: '⚠', info: '·' };
const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function penalized(results: Result[], config: Config): Result[] {
  return results.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
}

/** Compact terminal report for one route's penalized findings; '' when the route is clean. */
export function formatDevReport(route: string, results: Result[], config: Config): string {
  const failing = penalized(results, config).sort(
    (a, b) => RANK[effectiveSeverity(a, config)] - RANK[effectiveSeverity(b, config)] || a.id.localeCompare(b.id)
  );
  if (failing.length === 0) return '';
  const lines = [`[svelte-vitals] ${route}`];
  for (const r of failing) {
    lines.push(`  ${GLYPH[effectiveSeverity(r, config)]} ${r.id}  ${r.message}`);
  }
  return lines.join('\n');
}

/** Stable signature of a route's penalized findings, so a route is re-printed only when it changes. */
export function findingSignature(results: Result[], config: Config): string {
  return penalized(results, config)
    .map((r) => `${r.id}:${effectiveSeverity(r, config)}:${r.detection.presence}:${r.detection.value}`)
    .sort()
    .join('|');
}
