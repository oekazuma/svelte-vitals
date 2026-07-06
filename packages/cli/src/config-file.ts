import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Config } from '@svelte-vitals/core';

/**
 * SPIKE PROTOTYPE — not wired into the CLI/vite/MCP entry points. See the design
 * doc (docs/superpowers/specs/2026-07-05-config-file-design.md) for the full
 * rationale, the file/loader/priority decisions, and the follow-up plan.
 *
 * Candidate filenames, in priority order. Only `cwd` itself is searched (no
 * upward directory walk — see design doc §1).
 */
const CONFIG_FILENAMES = ['svelte-vitals.config.mjs', 'svelte-vitals.config.js', 'svelte-vitals.config.ts'];

function isMissingExtensionLoaderError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (('code' in err && (err as NodeJS.ErrnoException).code === 'ERR_UNKNOWN_FILE_EXTENSION') ||
      /Unknown file extension/.test(err.message))
  );
}

/**
 * Find and load `svelte-vitals.config.{mjs,js,ts}` from `cwd` (only `cwd`, no
 * upward search). Returns `undefined` when no candidate file exists.
 *
 * Loader mechanism (design doc §2): plain native `import()`. `.mjs`/`.js` always
 * work (zero dependencies, no Node-version dependency). `.ts` depends on the host
 * Node's TypeScript type-stripping support: unflagged in Node 23.6.0, backported
 * to 22.18.0; on 22.13–22.17 (this repo's floor is >=22.13.0) it requires
 * `--experimental-strip-types` and otherwise fails with
 * `ERR_UNKNOWN_FILE_EXTENSION` — this is caught here and rethrown as a
 * descriptive, actionable error instead of surfacing Node's raw error.
 *
 * Throws when: the file exists but has no usable default export, or (`.ts` only)
 * the host Node can't load TypeScript without a flag.
 */
export async function loadConfigFile(cwd: string): Promise<Partial<Config> | undefined> {
  const found = CONFIG_FILENAMES.map((name) => join(cwd, name)).find((path) => existsSync(path));
  if (!found) return undefined;

  let mod: { default?: unknown };
  try {
    mod = (await import(pathToFileURL(found).href)) as { default?: unknown };
  } catch (err) {
    if (found.endsWith('.ts') && isMissingExtensionLoaderError(err)) {
      throw new Error(
        `svelte-vitals: could not load ${found} — this Node runtime does not support TypeScript config ` +
          'files without a flag. Native type-stripping is unflagged from Node 22.18 / 23.6+: upgrade Node ' +
          'to 22.18+, re-run with --experimental-strip-types, or rename the file to .mjs/.js.',
        { cause: err }
      );
    }
    throw err;
  }

  if (!mod.default || typeof mod.default !== 'object') {
    throw new Error(
      `svelte-vitals: ${found} must have a default export (e.g. \`export default defineConfig({...})\` or a plain object).`
    );
  }
  return mod.default as Partial<Config>;
}
