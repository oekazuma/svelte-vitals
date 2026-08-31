import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { withReadLimit, type Runtime } from '@svelte-vitals/core/internal';
import { globFiles } from '../glob.js';

/**
 * Node implementation of the core Runtime abstraction (design §8). This is the
 * only place in the static-mode pipeline allowed to touch `node:` APIs; the
 * provider and rules stay runtime-agnostic by going through this interface.
 */
export function createNodeRuntime(): Runtime {
  const boundedRead = withReadLimit((path) => readFile(path, 'utf8'));
  return {
    readFile(path) {
      return boundedRead(path);
    },
    async exists(path) {
      try {
        await access(path);
        return true;
      } catch {
        return false;
      }
    },
    glob(pattern, cwd) {
      return globFiles(pattern, cwd);
    },
    join(...parts) {
      return join(...parts);
    }
  };
}
