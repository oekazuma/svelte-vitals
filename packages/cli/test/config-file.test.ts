import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';
import { loadConfigFile } from '../src/config-file.js';

/**
 * Loader + validation tests (design doc: docs/superpowers/specs/2026-07-05-config-file-design.md).
 * `loadConfigFile` is wired into `analyzeProject` (packages/cli/src/index.ts).
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
    const loaded = await loadConfigFile(fixture('config-file-mjs'));
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config).toEqual({
      treatDynamicAs: 'warn',
      failOn: 'warning',
      rules: { SEO001: 'off' }
    });
  });

  it('loads a .mjs config file that uses defineConfig (dogfooding)', async () => {
    const loaded = await loadConfigFile(fixture('config-file-defineconfig'));
    // defineConfig() merges over defaultConfig, so the loaded value is a full Config.
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config).toMatchObject({
      failOn: 'info',
      metaComponents: ['Seo'],
      treatDynamicAs: 'pass',
      rules: {}
    });
  });

  it('rejects a config file with no default export', async () => {
    await expect(loadConfigFile(fixture('config-file-invalid'))).rejects.toThrow(/must have a default export/);
  });

  it('rejects a config file whose default export is an array, not a plain object', async () => {
    await expect(loadConfigFile(fixture('config-file-default-export-array'))).rejects.toThrow(
      /must have a default export that is a plain object/
    );
  });

  it('rejects an unknown rule id in rules, listing known rule ids', async () => {
    await expect(loadConfigFile(fixture('config-file-unknown-rule'))).rejects.toThrow(
      /unknown rule id\(s\) in rules: NOPE999.*Known rule ids:/s
    );
  });

  it('rejects a negative weight', async () => {
    await expect(loadConfigFile(fixture('config-file-bad-weights'))).rejects.toThrow(/invalid weight for 'seo'/);
  });

  it('rejects an unknown category key in weights', async () => {
    await expect(loadConfigFile(fixture('config-file-bad-weights-category'))).rejects.toThrow(
      /unknown category 'bogus' in weights/
    );
  });

  it('loads a valid weights map through to config.weights', async () => {
    const loaded = await loadConfigFile(fixture('config-file-weights'));
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config.weights).toEqual({ seo: 2, performance: 1.5 });
  });

  it('rejects a rules value that is not a plain object (null) with a clear message', async () => {
    await expect(loadConfigFile(fixture('config-file-rules-null'))).rejects.toThrow(
      /rules must be an object of rule-id → setting/
    );
  });

  it('rejects a weights value that is not a plain object (array) with a clear message', async () => {
    await expect(loadConfigFile(fixture('config-file-weights-array'))).rejects.toThrow(
      /weights must be an object of category → number/
    );
  });

  it('accepts weights category keys case-insensitively, normalizing to lowercase', async () => {
    const loaded = await loadConfigFile(fixture('config-file-weights-uppercase'));
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config.weights).toEqual({ seo: 2 });
  });

  it('loads valid scoped overrides through to config.overrides', async () => {
    const loaded = await loadConfigFile(fixture('config-file-overrides'));
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config.overrides).toEqual([
      { files: 'src/routes/(app)/**', rules: { seo: 'off' } },
      { route: ['/admin', '/admin/**'], rules: { SEO001: 'warning' } }
    ]);
  });

  it('rejects an overrides value that is not an array', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-not-array'))).rejects.toThrow(
      /overrides must be an array/
    );
  });

  it('rejects an overrides entry whose route is not a string or non-empty string array', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-bad-route'))).rejects.toThrow(
      /overrides\[0\]\.route must be a string or a non-empty array of strings/
    );
  });

  it('rejects an overrides entry that sets neither route nor files', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-no-scope'))).rejects.toThrow(
      /overrides\[0\] must set 'route' and\/or 'files'/
    );
  });

  it('rejects an overrides rules key that is neither a known rule id nor a category', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-unknown-rule'))).rejects.toThrow(
      /unknown rule id\(s\) or categor(y|ies) in overrides\[0\]\.rules: SEO999/
    );
  });

  it('rejects an overrides rules value that is not off or a severity', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-bad-value'))).rejects.toThrow(
      /overrides\[0\]\.rules\.SEO001: invalid setting 'nope'/
    );
  });

  it('warns (without rejecting) on a metaComponents value that is not an array of strings, dropping the field', async () => {
    const loaded = await loadConfigFile(fixture('config-file-bad-metacomponents'));
    expect(loaded?.config.metaComponents).toBeUndefined();
    expect(loaded?.warnings.some((w) => w.includes('metaComponents must be an array of strings'))).toBe(true);
    // Valid sibling fields are still adopted.
    expect(loaded?.config.failOn).toBe('warning');
  });

  it('warns (without rejecting) on an invalid enum value and an unknown top-level key', async () => {
    const loaded = await loadConfigFile(fixture('config-file-warnings'));
    expect(loaded?.config.treatDynamicAs).toBeUndefined();
    expect(loaded?.warnings.some((w) => w.includes("unknown treatDynamicAs 'nope'"))).toBe(true);
    expect(loaded?.warnings.some((w) => w.includes("unknown config key 'someFutureOption'"))).toBe(true);
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
