import type { Runtime } from '@svelte-vitals/core';

/**
 * In-memory Runtime for tests (design §8): lets the provider run with no real
 * files, proving the pipeline is runtime-agnostic. Paths are POSIX strings.
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
      const re = globToRegExp(pattern);
      return [...map.keys()].filter((key) => re.test(key)).sort();
    },
    join(...parts) {
      return parts.filter((p) => p.length > 0).join('/');
    }
  };
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  return new RegExp(`^${body}$`);
}
