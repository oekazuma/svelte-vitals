import {
  collectComponentFacts as collect,
  collectKitModuleFacts as collectKit,
  collectSourceFiles as collectFiles,
  type ComponentFacts,
  type KitAlias,
  type KitModuleFacts
} from '@svelte-vitals/core/internal';
import { createNodeRuntime } from 'svelte-vitals';

const nodeRuntime = createNodeRuntime();

/**
 * Scan every `.svelte` component under `src/` for Correctness/Security/Architecture/
 * Bundle-Performance/Accessibility facts (build mode only). Implementation lives in
 * `@svelte-vitals/core` (plans/003) and is shared with the CLI package.
 */
export function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  return collect(nodeRuntime, root);
}

/** Scan SvelteKit route/hooks files for SSR shared-state facts (security/handler-state-write, security/server-module-state, security/shared-state-import; build mode only). */
export function collectKitModuleFacts(root: string, aliases?: readonly KitAlias[]): Promise<KitModuleFacts[]> {
  return collectKit(nodeRuntime, root, aliases);
}

/** Every file under `src/` for directory-shaped Architecture rules (build mode only). */
export function collectSourceFiles(root: string): Promise<string[]> {
  return collectFiles(nodeRuntime, root);
}
