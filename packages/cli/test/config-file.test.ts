import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { loadConfigFile, loadConfigFromPath } from '../src/config-file.js';

/**
 * Loader + validation tests (design doc: docs/superpowers/specs/2026-07-05-config-file-design.md).
 * `loadConfigFile` is wired into `analyzeProject` (packages/cli/src/index.ts).
 */

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

describe('loadConfigFile', () => {
  it('returns undefined when no config file exists', async () => {
    await expect(loadConfigFile(fixture('config-file-none'))).resolves.toBeUndefined();
  });

  it('loads a plain-object .js config file', async () => {
    const loaded = await loadConfigFile(fixture('config-file-js'));
    expect(loaded?.warnings).toEqual([]);
    expect(loaded?.config).toEqual({
      treatDynamicAs: 'warn',
      failOn: 'warning',
      rules: { 'seo/title-presence': 'off' }
    });
  });

  it('loads a .js config file that uses defineConfig (dogfooding)', async () => {
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

  it('fails loudly on a retired svelte-vitals.config.mjs instead of silently using defaults', async () => {
    await expect(loadConfigFile(fixture('config-file-retired-mjs'))).rejects.toThrow(
      /no longer read.*svelte-vitals\.config\.\{js,ts\}/s
    );
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
      /unknown rule id\(s\) in rules: NOPE999.*Known rule ids \(svelte-vitals \d.*core \d.*\):/s
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
      { route: ['/admin', '/admin/**'], rules: { 'seo/title-presence': 'warning' } }
    ]);
  });

  it('rejects an overrides value that is not an array', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-not-array'))).rejects.toThrow(
      /overrides must be an array/
    );
  });

  it('rejects an overrides entry whose route is not a non-empty string or non-empty string array', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-bad-route'))).rejects.toThrow(
      /overrides\[0\]\.route must be a non-empty string or a non-empty array of non-empty strings/
    );
  });

  it('rejects an empty route glob (it would silently never match)', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-empty-route'))).rejects.toThrow(
      /overrides\[0\]\.route must be a non-empty string or a non-empty array of non-empty strings/
    );
  });

  it('rejects an empty string inside a files glob array', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-empty-files'))).rejects.toThrow(
      /overrides\[0\]\.files must be a non-empty string or a non-empty array of non-empty strings/
    );
  });

  it('rejects an overrides entry with an empty rules object (it would change nothing)', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-empty-rules'))).rejects.toThrow(
      /overrides\[0\]\.rules must contain at least one rule id or category/
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
      /overrides\[0\]\.rules\.seo\/title-presence: invalid setting 'nope'/
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

  it('accepts the object form with options', async () => {
    const loaded = await loadConfigFile(fixture('config-file-options-object'));
    expect(loaded?.config.rules!['architecture/prop-count']).toEqual({
      severity: 'warning',
      options: { max: 10 }
    });
  });

  it('rejects an unknown option key', async () => {
    await expect(loadConfigFile(fixture('config-file-options-unknown-key'))).rejects.toThrow(/unknown option 'maxx'/);
  });

  it('rejects options on a rule that takes none', async () => {
    await expect(loadConfigFile(fixture('config-file-options-none-allowed'))).rejects.toThrow(/takes no options/);
  });

  it('accepts an empty options object on a rule that takes none', async () => {
    const loaded = await loadConfigFile(fixture('config-file-options-empty'));
    expect(loaded?.config.rules!['seo/charset']).toEqual({ options: {} });
  });

  it('rejects an out-of-range integer option', async () => {
    await expect(loadConfigFile(fixture('config-file-options-out-of-range'))).rejects.toThrow(/must be >= 1/);
  });

  it('rejects a wrongly-typed option', async () => {
    await expect(loadConfigFile(fixture('config-file-options-wrong-type'))).rejects.toThrow(/must be an integer/);
  });

  it('rejects an unknown option on architecture/private-scope-import', async () => {
    await expect(loadConfigFile(fixture('config-file-private-scope-unknown-option'))).rejects.toThrow(
      /unknown option 'scope'/
    );
  });

  it('rejects a non-list scopes value', async () => {
    await expect(loadConfigFile(fixture('config-file-private-scope-bad-type'))).rejects.toThrow(
      /must be an array of non-empty strings/
    );
  });

  it('rejects an inverted min/max range (Finding 3, 2026-07-26 review)', async () => {
    await expect(loadConfigFile(fixture('config-file-options-min-max-inverted'))).rejects.toThrow(
      /min \(100\) must be <= max \(60\)/
    );
  });

  it('accepts an override that only narrows one side of an otherwise-valid global range (Finding A, second review)', async () => {
    const loaded = await loadConfigFile(fixture('config-file-overrides-options-valid-layered-range'));
    expect(loaded?.config.rules?.['seo/title-length']).toEqual({ options: { min: 100, max: 200 } });
    expect(loaded?.config.overrides![0]!.rules['seo/title-length']).toEqual({ options: { min: 150 } });
  });

  it('rejects an override whose RESOLVED range is inverted even though neither layer is inverted alone (Finding A, second review)', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-options-resolved-inverted'))).rejects.toThrow(
      /min \(40\) must be <= max \(35\)/
    );
  });

  it('accepts two override entries that jointly widen a range, when validating one against the built-in default alone would falsely invert it (Finding A, third pass)', async () => {
    const loaded = await loadConfigFile(fixture('config-file-overrides-options-joint-range'));
    expect(loaded?.config.overrides![0]!.rules['seo/title-length']).toEqual({ options: { max: 200 } });
    expect(loaded?.config.overrides![1]!.rules['seo/title-length']).toEqual({ options: { min: 100 } });
  });

  it('rejects an unknown key inside a setting object', async () => {
    await expect(loadConfigFile(fixture('config-file-setting-unknown-key'))).rejects.toThrow(/unknown key/);
  });

  it('rejects an invalid severity in the object form', async () => {
    await expect(loadConfigFile(fixture('config-file-setting-bad-severity'))).rejects.toThrow(/invalid setting/);
  });

  it('rejects options under a category key in overrides', async () => {
    await expect(loadConfigFile(fixture('config-file-overrides-options-category'))).rejects.toThrow(
      /options are not allowed on a category key/
    );
  });

  it('accepts options in an override entry', async () => {
    const loaded = await loadConfigFile(fixture('config-file-overrides-options'));
    expect(loaded?.config.overrides![0]!.rules['architecture/prop-count']).toEqual({ options: { max: 4 } });
  });

  // The `.ts`-config contract under a bare `node` is asserted in
  // scripts/floor-smoke.js. It cannot live here: vitest's module runner
  // transforms in-process dynamic `import()`, so a `.ts` config always loads
  // inside vitest regardless of the host Node.
});

describe('loadConfigFromPath', () => {
  it('loads a config the caller named, ignoring cwd discovery', async () => {
    const loaded = await loadConfigFromPath(join(fixture('config-file-js'), 'svelte-vitals.config.js'));
    expect(loaded.config).toEqual({
      treatDynamicAs: 'warn',
      failOn: 'warning',
      rules: { 'seo/title-presence': 'off' }
    });
  });

  it('rejects an extension the loader does not support, before touching the disk', async () => {
    // .mjs was retired with a loud tripwire in discovery; a by-path loader that just
    // import()s would resurrect it silently.
    await expect(loadConfigFromPath('/nowhere/svelte-vitals.config.mjs')).rejects.toThrow(/\.js and \.ts only/);
  });

  it('treats a missing named file as fatal', async () => {
    await expect(loadConfigFromPath(join(fixture('config-file-none'), 'svelte-vitals.config.js'))).rejects.toThrow(
      /does not exist/
    );
  });
});
