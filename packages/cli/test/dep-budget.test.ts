import { describe, it, expect } from 'vitest';
import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Production dependency closure allowed per published package — unique name@version pairs
 * reachable through `dependencies` / `optionalDependencies`, the workspace siblings included.
 * Each number is the measured status quo, not an ideal: `svelte` alone is ~20 of core's and
 * is the parser, so it is the floor. Lowering a ceiling is welcome; RAISING one is a design
 * decision that needs a recorded reason in the PR, not a number edit.
 */
const BUDGET: Record<string, number> = {
  '@svelte-vitals/core': 21,
  'svelte-vitals': 59,
  '@svelte-vitals/vite': 71
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const pkgDir: Record<string, string> = {
  '@svelte-vitals/core': 'packages/core',
  'svelte-vitals': 'packages/cli',
  '@svelte-vitals/vite': 'packages/vite'
};

function readPkg(dir: string): {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
} {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

// Node resolution without the `exports` map: walk up from `from` for node_modules/<name>, then
// realpath so pnpm's virtual-store layout (.pnpm/<name>@<ver>/node_modules/<name>) is where the
// next hop's siblings live.
function locate(name: string, from: string): string | null {
  for (let dir = from; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate);
    if (dir === dirname(dir)) return null;
  }
}

function closure(dir: string): Set<string> {
  const seen = new Set<string>();
  const visit = (d: string): void => {
    const pkg = readPkg(d);
    for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.optionalDependencies })) {
      const found = locate(name, d);
      if (!found) {
        if (pkg.optionalDependencies?.[name] === range) continue;
        throw new Error(`${pkg.name}: dependency ${name} is not installed`);
      }
      const dep = readPkg(found);
      const key = `${dep.name}@${dep.version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visit(found);
    }
  };
  visit(dir);
  return seen;
}

describe('production dependency budget', () => {
  for (const [name, max] of Object.entries(BUDGET)) {
    it(`${name} pulls in at most ${max} packages`, () => {
      const deps = closure(join(root, pkgDir[name]!));
      expect(deps.size, `${name} closure:\n${[...deps].sort().join('\n')}`).toBeLessThanOrEqual(max);
    });
  }
});
