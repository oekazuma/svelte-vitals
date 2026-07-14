import { describe, it, expect } from 'vitest';
import {
  nodeSupportsNativeTypeScript,
  findExistingConfigFile,
  detectBestConfigExtension
} from '../../src/install/config-file-format.js';

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
  it('returns undefined when none of the three candidates exist', () => {
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

describe('detectBestConfigExtension', () => {
  it('picks .mjs when the Node version cannot load .ts natively, even with a tsconfig.json', () => {
    const files: Record<string, string> = { '/proj/tsconfig.json': '{}' };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v22.13.0' });
    expect(ext).toBe('mjs');
  });
  it('picks .ts when Node supports it and a tsconfig.json is present', () => {
    const files: Record<string, string> = { '/proj/tsconfig.json': '{}' };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v22.18.0' });
    expect(ext).toBe('ts');
  });
  it('picks .ts when Node supports it and a vite.config.ts is present (no tsconfig.json)', () => {
    const files: Record<string, string> = { '/proj/vite.config.ts': 'export default {}' };
    const ext = detectBestConfigExtension({ readFile: (p) => files[p], cwd: '/proj', nodeVersion: 'v24.16.0' });
    expect(ext).toBe('ts');
  });
  it('picks .mjs when Node supports .ts but the project has neither tsconfig.json nor vite.config.ts', () => {
    const ext = detectBestConfigExtension({ readFile: () => undefined, cwd: '/proj', nodeVersion: 'v24.16.0' });
    expect(ext).toBe('mjs');
  });
});
