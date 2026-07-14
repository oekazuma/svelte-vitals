import { describe, it, expect } from 'vitest';
import {
  nodeSupportsNativeTypeScript,
  findExistingConfigFile,
  hasSvelteVitalsDependency,
  isEsmProject,
  detectBestConfigExtension
} from '../../src/install/config-file-format.js';
import { CONFIG_FILENAMES } from '../../src/config-file.js';

describe('nodeSupportsNativeTypeScript', () => {
  it('is false below 22.18', () => {
    expect(nodeSupportsNativeTypeScript('v22.13.0')).toBe(false);
    expect(nodeSupportsNativeTypeScript('v22.17.9')).toBe(false);
  });
  it('is true from 22.18 onward on the 22.x line', () => {
    expect(nodeSupportsNativeTypeScript('v22.18.0')).toBe(true);
    expect(nodeSupportsNativeTypeScript('v22.99.0')).toBe(true);
  });
  it('is false on 23.0–23.5', () => {
    expect(nodeSupportsNativeTypeScript('v23.0.0')).toBe(false);
    expect(nodeSupportsNativeTypeScript('v23.5.9')).toBe(false);
  });
  it('is true from 23.6 onward', () => {
    expect(nodeSupportsNativeTypeScript('v23.6.0')).toBe(true);
  });
  it('is true for any later major (24, 26, ...)', () => {
    expect(nodeSupportsNativeTypeScript('v24.16.0')).toBe(true);
    expect(nodeSupportsNativeTypeScript('v26.0.0')).toBe(true);
  });
  it('handles a version string without a leading v', () => {
    expect(nodeSupportsNativeTypeScript('22.18.0')).toBe(true);
  });
  it('is false for an unparseable version', () => {
    expect(nodeSupportsNativeTypeScript('not-a-version')).toBe(false);
  });
});

describe('findExistingConfigFile', () => {
  it('checks exactly the loader’s own candidate list (no second hand-maintained copy)', () => {
    const probed: string[] = [];
    findExistingConfigFile((p) => {
      probed.push(p);
      return undefined;
    }, '/proj');
    expect(probed).toEqual(CONFIG_FILENAMES.map((n) => `/proj/${n}`));
  });
  it('returns undefined when none of the candidates exist', () => {
    expect(findExistingConfigFile(() => undefined, '/proj')).toBeUndefined();
  });
  it('finds an existing .mjs file', () => {
    const files: Record<string, string> = { '/proj/svelte-vitals.config.mjs': 'x' };
    expect(findExistingConfigFile((p) => files[p], '/proj')).toBe('svelte-vitals.config.mjs');
  });
  it('finds an existing .ts file when .mjs/.js are absent', () => {
    const files: Record<string, string> = { '/proj/svelte-vitals.config.ts': 'x' };
    expect(findExistingConfigFile((p) => files[p], '/proj')).toBe('svelte-vitals.config.ts');
  });
  it('prefers .mjs over .ts when both somehow exist, matching the real loader priority', () => {
    const files: Record<string, string> = {
      '/proj/svelte-vitals.config.mjs': 'x',
      '/proj/svelte-vitals.config.ts': 'y'
    };
    expect(findExistingConfigFile((p) => files[p], '/proj')).toBe('svelte-vitals.config.mjs');
  });
});

describe('hasSvelteVitalsDependency', () => {
  it('is false with no package.json', () => {
    expect(hasSvelteVitalsDependency(() => undefined, '/proj')).toBe(false);
  });
  it('is false when svelte-vitals is not declared', () => {
    const files: Record<string, string> = {
      '/proj/package.json': JSON.stringify({ devDependencies: { vite: '^8.0.0' } })
    };
    expect(hasSvelteVitalsDependency((p) => files[p], '/proj')).toBe(false);
  });
  it('is true for a devDependency', () => {
    const files: Record<string, string> = {
      '/proj/package.json': JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })
    };
    expect(hasSvelteVitalsDependency((p) => files[p], '/proj')).toBe(true);
  });
  it('is true for a regular dependency', () => {
    const files: Record<string, string> = {
      '/proj/package.json': JSON.stringify({ dependencies: { 'svelte-vitals': '^0.26.0' } })
    };
    expect(hasSvelteVitalsDependency((p) => files[p], '/proj')).toBe(true);
  });
  it('is false for unparseable package.json', () => {
    const files: Record<string, string> = { '/proj/package.json': '{not json' };
    expect(hasSvelteVitalsDependency((p) => files[p], '/proj')).toBe(false);
  });
});

describe('isEsmProject', () => {
  it('is true only for "type": "module"', () => {
    const esm: Record<string, string> = { '/proj/package.json': JSON.stringify({ type: 'module' }) };
    const cjs: Record<string, string> = { '/proj/package.json': JSON.stringify({ name: 'x' }) };
    expect(isEsmProject((p) => esm[p], '/proj')).toBe(true);
    expect(isEsmProject((p) => cjs[p], '/proj')).toBe(false);
    expect(isEsmProject(() => undefined, '/proj')).toBe(false);
  });
});

const TS_PROJECT_FILES: Record<string, string> = {
  '/proj/tsconfig.json': '{}',
  '/proj/package.json': JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })
};

describe('detectBestConfigExtension', () => {
  it('picks .mjs when the Node version cannot load .ts natively, even in a full TS project', () => {
    const ext = detectBestConfigExtension({
      readFile: (p) => TS_PROJECT_FILES[p],
      cwd: '/proj',
      nodeVersion: 'v22.13.0'
    });
    expect(ext).toBe('mjs');
  });
  it('picks .ts when Node supports it, tsconfig.json is present, and svelte-vitals is a dependency', () => {
    const ext = detectBestConfigExtension({
      readFile: (p) => TS_PROJECT_FILES[p],
      cwd: '/proj',
      nodeVersion: 'v22.18.0'
    });
    expect(ext).toBe('ts');
  });
  it('a vite.config.ts alone (no tsconfig.json) also counts as TypeScript-oriented', () => {
    const files: Record<string, string> = {
      '/proj/vite.config.ts': 'export default {}',
      '/proj/package.json': JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })
    };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v24.16.0' });
    expect(ext).toBe('ts');
  });
  it('picks .mjs for an npx-only project (no svelte-vitals dependency) — the defineConfig import would not resolve', () => {
    const files: Record<string, string> = {
      '/proj/tsconfig.json': '{}',
      '/proj/package.json': JSON.stringify({ devDependencies: { vite: '^8.0.0' } })
    };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v24.16.0' });
    expect(ext).toBe('mjs');
  });
  it('picks .mjs when Node supports .ts but the project has neither tsconfig.json nor vite.config.ts', () => {
    const files: Record<string, string> = {
      '/proj/package.json': JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })
    };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v24.16.0' });
    expect(ext).toBe('mjs');
  });
});
