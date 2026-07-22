import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { findMinifyDisabled, type Project } from '@svelte-vitals/core';

/**
 * performance/minify-disabled fact from the RESOLVED Vite config — exact, so it also catches
 * function-form/conditional configs the CLI's literal-only static pass skips.
 * The config source is re-parsed only to locate the line. `file` is never
 * fabricated: unset for an inline programmatic config (no `configFile` at
 * all), and always a posix-relative path to `root` (may start with `../` in
 * monorepos) — never an absolute path. `line` is set only when the literal
 * `minify: false` could be located in that file; a dynamic config that still
 * resolves to `minify: false` (or an unreadable file) omits it, since the
 * resolved value already proved the finding without needing a line.
 */
export async function resolveMinifyDisabled(
  minify: unknown,
  configFile: string | undefined,
  root: string
): Promise<Project['viteMinifyDisabled']> {
  if (minify !== false) return undefined;
  if (!configFile) return {}; // inline programmatic config — no file to point at
  const rel = relative(root, configFile).split('\\').join('/');
  const file = rel === '' ? configFile.split('\\').join('/') : rel;
  let line: number | undefined;
  try {
    line = findMinifyDisabled(await readFile(configFile, 'utf8'))?.line;
  } catch {
    // unreadable config source — the resolved value already proved the finding
  }
  return { file, ...(line !== undefined ? { line } : {}) };
}
