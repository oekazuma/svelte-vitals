import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { analyzeProject } from '../src/index.js';
import { parseRunArgs, resolveArgs } from '../src/resolve-args.js';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

describe('--config <path>', () => {
  it('parses onto RunOptions.configPath', () => {
    const { options, errors } = resolveArgs(parseRunArgs(['--config', 'other.config.js']));
    expect(errors).toEqual([]);
    expect(options?.configPath).toBe('other.config.js');
  });

  it('rejects a bare --config like every other value flag', () => {
    const { errors } = resolveArgs(parseRunArgs(['--config']));
    expect(errors).toContain('svelte-vitals: --config requires a value.');
  });

  it('loads the named config instead of the one in the analyzed directory', async () => {
    // The fixture project's own config turns seo/title-presence off; the named one does not,
    // so the rule running again is proof discovery was skipped rather than merged.
    const withOwn = await analyzeProject({ cwd: fixture('config-file-js') });
    expect(withOwn.config.rules['seo/title-presence']).toBe('off');

    const withNamed = await analyzeProject({
      cwd: fixture('config-file-js'),
      configPath: join(fixture('config-file-named'), 'svelte-vitals.config.js')
    });
    expect(withNamed.config.rules['seo/title-presence']).toBeUndefined();
  });

  it('fails the run when the named config does not exist', async () => {
    await expect(analyzeProject({ cwd: fixture('config-file-js'), configPath: 'no-such.config.js' })).rejects.toThrow(
      /does not exist/
    );
  });
});
