import { readFileSync } from 'node:fs';

/** Read this package's version from its own package.json so the report never drifts. */
export function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Read the *actually resolved* `@svelte-vitals/core` version — the rule engine
 * that determines which findings get reported. `@svelte-vitals/vite` and the
 * `svelte-vitals` CLI are versioned independently and can end up depending on
 * different core versions (e.g. a lockfile/registry cooldown resolving a CLI
 * `@latest` install down to an older release than what this plugin depends on);
 * surfacing this in the live dashboard lets users directly compare "rule engine
 * version" against the CLI's `--version` output instead of guessing from
 * unrelated outer package version numbers. `@svelte-vitals/core` stays an
 * external (unbundled) dependency in the tsup build, so this resolves against
 * the real installed package at runtime, not whatever was bundled in.
 */
export function readCoreVersion(): string {
  try {
    const entry = import.meta.resolve('@svelte-vitals/core');
    const pkg = JSON.parse(readFileSync(new URL('../package.json', entry), 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}
