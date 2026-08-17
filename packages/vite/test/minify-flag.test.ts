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
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({
      file: 'vite.config.ts',
      line: 3,
      suppressions: []
    });
  });

  it('omits the line for a dynamic config that still resolves to false', async () => {
    const file = join(root, 'vite.config.dynamic.ts');
    await writeFile(file, `export default () => ({ build: { minify: false } });\n`);
    expect(await resolveMinifyDisabled(false, file, root)).toEqual({
      file: 'vite.config.dynamic.ts',
      suppressions: []
    });
  });

  it('returns an empty fact (no file, no line) for an inline programmatic config', async () => {
    expect(await resolveMinifyDisabled(false, undefined, root)).toEqual({});
  });

  it('omits the line when the config file is unreadable', async () => {
    expect(await resolveMinifyDisabled(false, join(root, 'missing.config.ts'), root)).toEqual({
      file: 'missing.config.ts'
    });
  });

  it('uses a ../-prefixed posix relative path for a config file outside root, never an absolute path', async () => {
    // A dedicated scratch dir (not the shared `root`) so the "outside root" config
    // file lives in its own monorepo-like layout, not directly in the OS tmpdir.
    const monorepo = await mkdtemp(join(tmpdir(), 'sv-minify-monorepo-'));
    try {
      const outerConfig = join(monorepo, 'vite.config.ts');
      await writeFile(outerConfig, `export default {\n  build: {\n    minify: false\n  }\n};\n`);
      const inner = join(monorepo, 'app');
      const result = await resolveMinifyDisabled(false, outerConfig, inner);
      expect(result?.file).toBe('../vite.config.ts');
      expect(result?.file?.startsWith('/')).toBe(false);
      expect(result?.line).toBe(3);
    } finally {
      await rm(monorepo, { recursive: true, force: true });
    }
  });
});
