import { isPenalized, effectiveSeverity, type Config, type Result } from '@svelte-vitals/core';

function penalized(results: Result[], config: Config): Result[] {
  return results.filter((r) => isPenalized(r.detection, config.treatDynamicAs));
}

/** Stable signature of a route's penalized findings, so ingest is skipped when a repeat visit finds nothing new. */
export function findingSignature(results: Result[], config: Config): string {
  return penalized(results, config)
    .map((r) => `${r.id}:${effectiveSeverity(r, config)}:${r.detection.presence}:${r.detection.value}`)
    .sort()
    .join('|');
}
