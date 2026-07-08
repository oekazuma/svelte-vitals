import { describe, it, expect } from 'vitest';
import { readPackageVersion, readCoreVersion } from '../src/version.js';

describe('readPackageVersion', () => {
  it('reads the CLI package own version (non-empty semver-ish string)', () => {
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('readCoreVersion', () => {
  it('resolves the actually-installed @svelte-vitals/core version, not the CLI own version', () => {
    // These are two independently versioned packages (see the bug this guards against:
    // a lockfile cooldown can pin the CLI to an older core than the Vite plugin depends
    // on, with no visible signal) — asserting the shape here, not equality to the CLI's.
    expect(readCoreVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
