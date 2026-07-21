import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveMinifyDisabled } from '../src/minify-flag.js';

describe('resolveMinifyDisabled', () => {
  let root: string;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'sv-minify-'));
  });
  afterAll(async () => rm(root, { recursive: true, force: true }));

  it('returns undefined unless the resolved value is exactly false', async () => {
    expect(await resolveMinifyDisabled('esbuild', join(root, 'vite.config.ts'), root)).toBeUndefined();
    expect(await resolveMinifyDisabled('terser', undefined, root)).toBeUndefined();
    expect(await resolveMinifyDisabled(undefined, undefined, root)).toBeUndefined();
  });

  it('locates the line by re-parsing a literal config', async () => {
    const file = join(root, 'vite.config.ts');
    await writeFile(file, `export default {\n  build: {\n    minify: false\n  }\n};\n`);
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({ file: 'vite.config.ts', line: 3 });
  });

  it('falls back to line 1 for a dynamic config that still resolves to false', async () => {
    const file = join(root, 'vite.config.dynamic.ts');
    await writeFile(file, `export default () => ({ build: { minify: false } });\n`);
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({ file: 'vite.config.dynamic.ts', line: 1 });
  });

  it('falls back to vite.config.js line 1 when no config file path is known', async () => {
    expect(await resolveMinifyDisabled(false, undefined, root)).toEqual({ file: 'vite.config.js', line: 1 });
  });

  it('keeps line 1 when the config file is unreadable', async () => {
    expect(await resolveMinifyDisabled(false, join(root, 'missing.config.ts'), root)).toEqual({
      file: 'missing.config.ts',
      line: 1
    });
  });
});
