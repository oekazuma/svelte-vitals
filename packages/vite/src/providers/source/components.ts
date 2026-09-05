import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  collectComponentFacts as collect,
  collectKitModuleFacts as collectKit,
  collectSourceFiles as collectFiles,
  type ComponentFacts,
  type KitAlias,
  type KitModuleFacts,
  withReadLimit,
  type Runtime
} from '@svelte-vitals/core/internal';
import { globFiles } from 'svelte-vitals';

/**
 * Node-backed Runtime adapter (design §8). vite always runs in Node, so no
 * swappable runtime is needed here — this just satisfies the interface the
 * shared core implementation expects.
 */
const boundedRead = withReadLimit((path: string) => readFile(path, 'utf8'));

const nodeRuntime: Runtime = {
  readFile: (path) => boundedRead(path),
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
  glob: (pattern, cwd) => globFiles(pattern, cwd),
  join: (...parts) => join(...parts)
};

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
