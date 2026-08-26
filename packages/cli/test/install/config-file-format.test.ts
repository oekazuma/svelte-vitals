import { describe, it, expect } from 'vitest';
import {
  findExistingConfigFile,
  hasSvelteVitalsDependency,
  detectBestConfigExtension
} from '../../src/install/config-file-format.js';
import { CONFIG_FILENAMES } from '../../src/config-file.js';

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
  it('finds an existing .js file', () => {
    const files = new Map([['/proj/svelte-vitals.config.js', 'x']]);
    expect(findExistingConfigFile((p) => files.get(p), '/proj')).toBe('svelte-vitals.config.js');
  });
  it('finds an existing .ts file when .js is absent', () => {
    const files = new Map([['/proj/svelte-vitals.config.ts', 'x']]);
    expect(findExistingConfigFile((p) => files.get(p), '/proj')).toBe('svelte-vitals.config.ts');
  });
  it('prefers .js over .ts when both somehow exist, matching the real loader priority', () => {
    const files = new Map([
      ['/proj/svelte-vitals.config.js', 'x'],
      ['/proj/svelte-vitals.config.ts', 'y']
    ]);
    expect(findExistingConfigFile((p) => files.get(p), '/proj')).toBe('svelte-vitals.config.js');
  });
  it('the retired .mjs filename is no longer a candidate', () => {
    const files = new Map([['/proj/svelte-vitals.config.mjs', 'x']]);
    expect(findExistingConfigFile((p) => files.get(p), '/proj')).toBeUndefined();
  });
});

describe('hasSvelteVitalsDependency', () => {
  it('is false with no package.json', () => {
    expect(hasSvelteVitalsDependency(() => undefined, '/proj')).toBe(false);
  });
  it('is false when svelte-vitals is not declared', () => {
    const files = new Map([['/proj/package.json', JSON.stringify({ devDependencies: { vite: '^8.0.0' } })]]);
    expect(hasSvelteVitalsDependency((p) => files.get(p), '/proj')).toBe(false);
  });
  it('is true for a devDependency', () => {
    const files = new Map([
      ['/proj/package.json', JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })]
    ]);
    expect(hasSvelteVitalsDependency((p) => files.get(p), '/proj')).toBe(true);
  });
  it('is true for a regular dependency', () => {
    const files = new Map([['/proj/package.json', JSON.stringify({ dependencies: { 'svelte-vitals': '^0.26.0' } })]]);
    expect(hasSvelteVitalsDependency((p) => files.get(p), '/proj')).toBe(true);
  });
  it('is false for unparseable package.json', () => {
    const files = new Map([['/proj/package.json', '{not json']]);
    expect(hasSvelteVitalsDependency((p) => files.get(p), '/proj')).toBe(false);
  });
});

const TS_PROJECT_FILES = new Map([
  ['/proj/tsconfig.json', '{}'],
  ['/proj/package.json', JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })]
]);

describe('detectBestConfigExtension', () => {
  it('picks .ts when tsconfig.json is present and svelte-vitals is a dependency', () => {
    const ext = detectBestConfigExtension({ readFile: (p) => TS_PROJECT_FILES.get(p), cwd: '/proj' });
    expect(ext).toBe('ts');
  });
  it('a vite.config.ts alone (no tsconfig.json) also counts as TypeScript-oriented', () => {
    const files = new Map([
      ['/proj/vite.config.ts', 'export default {}'],
      ['/proj/package.json', JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })]
    ]);
    const ext = detectBestConfigExtension({ readFile: (p) => files.get(p), cwd: '/proj' });
    expect(ext).toBe('ts');
  });
  it('picks .js for an npx-only project (no svelte-vitals dependency) — the defineConfig import would not resolve', () => {
    const files = new Map([
      ['/proj/tsconfig.json', '{}'],
      ['/proj/package.json', JSON.stringify({ devDependencies: { vite: '^8.0.0' } })]
    ]);
    const ext = detectBestConfigExtension({ readFile: (p) => files.get(p), cwd: '/proj' });
    expect(ext).toBe('js');
  });
  it('picks .js when the project has neither tsconfig.json nor vite.config.ts', () => {
    const files = new Map([
      ['/proj/package.json', JSON.stringify({ devDependencies: { 'svelte-vitals': '^0.26.0' } })]
    ]);
    const ext = detectBestConfigExtension({ readFile: (p) => files.get(p), cwd: '/proj' });
    expect(ext).toBe('js');
  });
});
