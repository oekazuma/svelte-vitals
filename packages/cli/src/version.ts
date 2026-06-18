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
