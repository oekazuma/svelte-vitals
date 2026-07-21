import { readFile } from 'node:fs/promises';
import { relative, isAbsolute } from 'node:path';
import { findMinifyDisabled, type Project } from '@svelte-vitals/core';

/**
 * PERF012 fact from the RESOLVED Vite config — exact, so it also catches
 * function-form/conditional configs the CLI's literal-only static pass skips.
 * The config source is re-parsed only to locate the line; a dynamic config
 * that still resolves to `minify: false` falls back to line 1.
 */
export async function resolveMinifyDisabled(
  minify: unknown,
  configFile: string | undefined,
  root: string
): Promise<Project['viteMinifyDisabled']> {
  if (minify !== false) return undefined;
  let file = 'vite.config.js';
  let line = 1;
  if (configFile) {
    const rel = relative(root, configFile);
    file = rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel.split('\\').join('/') : configFile;
    try {
      line = findMinifyDisabled(await readFile(configFile, 'utf8'))?.line ?? 1;
    } catch {
      // unreadable config source — the resolved value already proved the finding
    }
  }
  return { file, line };
}
