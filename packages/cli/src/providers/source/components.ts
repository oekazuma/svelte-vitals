/**
 * Scan every `.svelte` component under `src/` for Correctness facts (#correctness).
 * Implementation lives in `@svelte-vitals/core` (plans/003) so the CLI and vite
 * packages share one definition instead of hand-syncing two copies.
 */
export { collectComponentFacts } from '@svelte-vitals/core';
