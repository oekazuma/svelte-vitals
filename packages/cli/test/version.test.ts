import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { readPackageVersion, readCoreVersion } from '../src/version.js';

describe('readPackageVersion', () => {
  it('reads the CLI package own version (non-empty semver-ish string)', () => {
    expect(readPackageVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('readCoreVersion', () => {
  it('resolves the actually-installed @svelte-vitals/core version, matching packages/core/package.json exactly', () => {
    // A bare semver-shape regex would also match '0.0.0', the try/catch fallback readCoreVersion
    // returns on a resolution failure — which would let this test pass even if resolution were
    // silently broken. Assert equality against the monorepo core's own package.json instead, so a
    // regression back to the fallback (the exact failure mode this function guards against) fails loudly.
    const corePkg = JSON.parse(readFileSync(new URL('../../core/package.json', import.meta.url), 'utf8')) as {
      version: string;
    };
    expect(readCoreVersion()).toBe(corePkg.version);
  });
});
