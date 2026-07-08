import { describe, it, expect } from 'vitest';
import { readPackageVersion, readCoreVersion } from '../src/version.js';

describe('readPackageVersion', () => {
  it('reads the @svelte-vitals/vite package own version (non-empty semver-ish string)', () => {
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('readCoreVersion', () => {
  it('resolves the actually-installed @svelte-vitals/core version, not the plugin own version', () => {
    // These are two independently versioned packages — the dev overlay and the CLI can end up
    // on different core (rule engine) versions with no visible signal; this is what lets the
    // overlay surface its own resolved core version for comparison against `svelte-vitals --version`.
    expect(readCoreVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
