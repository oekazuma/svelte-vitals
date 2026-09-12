import { describe, it, expect } from 'vitest';
import { readPackageVersion } from '../src/version.js';

describe('readPackageVersion', () => {
  it('reads the @svelte-vitals/vite package own version (non-empty semver-ish string)', () => {
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
