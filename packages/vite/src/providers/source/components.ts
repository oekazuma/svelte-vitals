import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import {
  collectComponentFacts as collect,
  collectKitModuleFacts as collectKit,
  type ComponentFacts,
  type KitModuleFacts,
  type Runtime
} from '@svelte-vitals/core';

/**
 * Node-backed Runtime adapter (design §8). vite always runs in Node, so no
 * swappable runtime is needed here — this just satisfies the interface the
 * shared core implementation expects.
 */
const nodeRuntime: Runtime = {
  readFile: (path) => readFile(path, 'utf8'),
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  glob: (pattern, cwd) => glob(pattern, { cwd, dot: false }),
  join: (...parts) => join(...parts)
};

/**
 * Scan every `.svelte` component under `src/` for Correctness/Security/Architecture/
 * Bundle-Performance facts (build mode only). Implementation lives in
 * `@svelte-vitals/core` (plans/003) and is shared with the CLI package.
 */
export function collectComponentFacts(root: string): Promise<ComponentFacts[]> {
  return collect(nodeRuntime, root);
}

/** Scan SvelteKit route/hooks files for SSR shared-state facts (security/handler-state-write, security/server-module-state, security/shared-state-import; build mode only). */
export function collectKitModuleFacts(root: string): Promise<KitModuleFacts[]> {
  return collectKit(nodeRuntime, root);
}
