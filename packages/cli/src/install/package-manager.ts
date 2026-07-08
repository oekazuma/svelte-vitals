import { join } from 'node:path';

export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm';

interface ReadCwd {
  cwd: string;
  readFile(path: string): string | undefined;
}

// Order matters: checked in this priority when multiple lockfiles coexist.
// Bun has shipped two lockfile formats — the newer text-based `bun.lock` (default
// since Bun 1.2) and the older binary `bun.lockb` — so both are checked.
const LOCKFILE_TO_PM: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lock': 'bun',
  'bun.lockb': 'bun'
};

/** Detect the project's package manager from its lockfile; defaults to npm. */
export function detectPackageManager(io: ReadCwd): PackageManager {
  for (const [file, pm] of Object.entries(LOCKFILE_TO_PM)) {
    if (io.readFile(join(io.cwd, file)) !== undefined) return pm;
  }
  return 'npm';
}

/** Whether @svelte-vitals/vite is already a (dev)dependency in package.json. */
export function hasVitePackage(io: ReadCwd): boolean {
  const raw = io.readFile(join(io.cwd, 'package.json'));
  if (raw === undefined) return false;
  try {
    const pkg = JSON.parse(raw) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return Boolean(pkg.dependencies?.['@svelte-vitals/vite'] || pkg.devDependencies?.['@svelte-vitals/vite']);
  } catch {
    return false;
  }
}

/** Build the install-as-devDependency command for a package manager. npm uses `install`, not `add`. */
export function installCommand(pm: PackageManager): { command: string; args: string[] } {
  const action = pm === 'npm' ? 'install' : 'add';
  return { command: pm, args: [action, '-D', '@svelte-vitals/vite'] };
}

/**
 * Read the version of @svelte-vitals/vite actually resolved into node_modules after
 * running installCommand — a lockfile/registry cooldown (e.g. pnpm's `minimumReleaseAge`)
 * can silently resolve the install to an older release than the latest published one, with
 * no other visible signal. Returns undefined if unreadable/unparsable; never throws.
 */
export function readInstalledViteVersion(io: ReadCwd): string | undefined {
  const raw = io.readFile(join(io.cwd, 'node_modules/@svelte-vitals/vite/package.json'));
  if (raw === undefined) return undefined;
  try {
    return (JSON.parse(raw) as { version?: string }).version;
  } catch {
    return undefined;
  }
}
