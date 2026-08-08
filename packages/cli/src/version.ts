import { readFileSync } from 'node:fs';

// Read the version from the package's own package.json at runtime so it never
// drifts from the published version (dist/*.js -> ../package.json). tsup inlines
// this module, so import.meta.url resolves to the bundling file's dist location.
export function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Read the *actually resolved* `@svelte-vitals/core` version — the rule engine
 * that determines which findings get reported. `svelte-vitals` and `@svelte-vitals/vite`
 * are versioned independently and can end up depending on different core versions
 * (e.g. a lockfile/registry cooldown like pnpm's `minimumReleaseAge` resolving
 * `@latest` down to an older release); surfacing this lets users directly compare
 * "rule engine version" between the CLI and the Vite live dashboard instead of
 * guessing from unrelated outer package version numbers. `@svelte-vitals/core`
 * stays an external (unbundled) dependency in the tsup build, so this resolves
 * against the real installed package at runtime, not whatever was bundled in.
 */
export function readCoreVersion(): string {
  try {
    const entry = import.meta.resolve('@svelte-vitals/core');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', entry), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
