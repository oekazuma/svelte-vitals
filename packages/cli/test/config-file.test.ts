import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import { loadConfigFile } from '../src/config-file.js';

/**
 * Spike prototype tests (design doc: docs/superpowers/specs/2026-07-05-config-file-design.md).
 * `loadConfigFile` is not wired into any entry point yet — these tests only
 * confirm the loader mechanism itself is viable.
 */

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

/**
 * Whether this Node runtime strips TypeScript types from `import()` without a
 * flag. Unflagged in 23.6.0, backported to 22.18.0 (design doc §2); on this
 * repo's floor (>=22.13.0), only 22.13–22.17 requires
 * `--experimental-strip-types`, so the `.ts` test below branches on this
 * instead of assuming a single Node version.
 */
function nodeSupportsUnflaggedTypeStripping(): boolean {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number);
  return (major === 22 && minor >= 18) || (major === 23 && minor >= 6) || major >= 24;
}

describe('loadConfigFile', () => {
  it('returns undefined when no config file exists', async () => {
    await expect(loadConfigFile(fixture('config-file-none'))).resolves.toBeUndefined();
  });

  it('loads a plain-object .mjs config file', async () => {
    const config = await loadConfigFile(fixture('config-file-mjs'));
    expect(config).toEqual({
      treatDynamicAs: 'warn',
      failOn: 'warning',
      rules: { SEO001: 'off' }
    });
  });

  it('loads a .mjs config file that uses defineConfig (dogfooding)', async () => {
    const config = await loadConfigFile(fixture('config-file-defineconfig'));
    // defineConfig() merges over defaultConfig, so the loaded value is a full Config.
    expect(config).toMatchObject({
      failOn: 'info',
      metaComponents: ['Seo'],
      treatDynamicAs: 'pass',
      rules: {}
    });
  });

  it('rejects a config file with no default export', async () => {
    await expect(loadConfigFile(fixture('config-file-invalid'))).rejects.toThrow(/must have a default export/);
  });

  // Spike finding: this MUST run in a child process. vitest's module runner
  // intercepts and transforms in-process dynamic `import()` calls, so a `.ts`
  // config always loads inside vitest regardless of the host Node's native
  // type-stripping support — native behavior is only observable by having a
  // real `node` process (no test-runner loader hooks) perform the import.
  it('native import() of a .ts config succeeds on Node 22.18+/23.6+, else fails with ERR_UNKNOWN_FILE_EXTENSION (child process)', () => {
    const tsUrl = pathToFileURL(join(fixture('config-file-ts'), 'svelte-vitals.config.ts')).href;
    const script = [
      'try {',
      `  const mod = await import(${JSON.stringify(tsUrl)});`,
      "  if (!mod.default) { console.error('NO_DEFAULT_EXPORT'); process.exit(1); }",
      '} catch (e) {',
      '  console.error(e && e.code ? e.code : String(e));',
      '  process.exit(1);',
      '}'
    ].join('\n');

    let exitCode = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        stdio: ['ignore', 'ignore', 'pipe']
      });
    } catch (err) {
      const e = err as { status?: number | null; stderr?: Buffer | string };
      exitCode = e.status ?? 1;
      stderr = String(e.stderr ?? '');
    }

    if (nodeSupportsUnflaggedTypeStripping()) {
      expect(exitCode).toBe(0);
    } else {
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('ERR_UNKNOWN_FILE_EXTENSION');
    }
  });
});
