import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { glob as tinyglob } from 'tinyglobby';
import type { Runtime } from '@svelte-vitals/core';

/**
 * Node implementation of the core Runtime abstraction (design §8). This is the
 * only place in the static-mode pipeline allowed to touch `node:` APIs; the
 * provider and rules stay runtime-agnostic by going through this interface.
 */
export function createNodeRuntime(): Runtime {
  return {
    readFile(path) {
      return readFile(path, 'utf8');
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
      return tinyglob(pattern, { cwd, dot: false });
    },
    join(...parts) {
      return join(...parts);
    }
  };
}
