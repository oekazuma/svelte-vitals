import { posix } from 'node:path';
import type { Runtime } from '@svelte-vitals/core/internal';

/**
 * In-memory Runtime for tests (design §8): lets the provider run with no real
 * files, proving the pipeline is runtime-agnostic. Paths are POSIX strings.
 * `matchesGlob` matches the real runtime glob's semantics (node:fs glob never
 * matches dot entries, so hidden dirs are skipped) including `{,.ts,.js}` brace expansion.
 */
export function createMemoryRuntime(files: Record<string, string>): Runtime {
  const map = new Map(Object.entries(files));
  return {
    async readFile(path) {
      const content = map.get(path);
      if (content === undefined) throw new Error(`ENOENT: ${path}`);
      return content;
    },
    async exists(path) {
      return map.has(path);
    },
    async glob(pattern) {
      return [...map.keys()].filter((key) => posix.matchesGlob(key, pattern)).sort();
    },
    join(...parts) {
      const joined = parts.filter((p) => p.length > 0).join('/');
      // Like node:path's join, so a path climbing out of cwd names the file it lands on.
      return joined.split('/').includes('..') ? posix.normalize(joined) : joined;
    }
  };
}
