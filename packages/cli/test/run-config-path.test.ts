import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { analyzeProject } from '../src/index.js';
import { parseRunArgs, resolveArgs } from '../src/resolve-args.js';

const fixture = (name: string) => join(import.meta.dirname, 'fixtures', name);

describe('--config <path>', () => {
  it('resolves a relative path against the shell cwd, not the analyzed directory', () => {
    const { options, errors } = resolveArgs(parseRunArgs(['apps/web', '--config', 'shared/sv.config.js']));
    expect(errors).toEqual([]);
    expect(options?.configPath).toBe(resolve('shared/sv.config.js'));
    expect(options?.configPath).not.toContain('apps/web');
  });

  it('leaves an absolute path alone', () => {
    const abs = join(fixture('config-file-named'), 'svelte-vitals.config.js');
    const { options } = resolveArgs(parseRunArgs(['--config', abs]));
    expect(options?.configPath).toBe(abs);
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

  it('resolves a programmatic relative configPath against process.cwd(), not the analyzed cwd', async () => {
    await expect(analyzeProject({ cwd: fixture('config-file-js'), configPath: 'no-such.config.js' })).rejects.toThrow(
      `${resolve('no-such.config.js')} does not exist.`
    );
  });
});
