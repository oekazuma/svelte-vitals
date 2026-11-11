import { join } from 'node:path';
import { detectPackageManagerFromLockfile } from '../install/package-manager.js';
import { readPkg } from '../pkg-json.js';

export type InstallStepPlan =
  | { kind: 'npm' }
  | { kind: 'pnpm' }
  /** `command` is what the commented block shows; `reason` is the sentence `ci install` prints. */
  | { kind: 'manual'; command: string; reason: string };

interface PackageManagerFields {
  packageManager?: unknown;
  devEngines?: { packageManager?: unknown };
}

const PNPM_COMMAND = 'pnpm install --frozen-lockfile --ignore-scripts';

/** The major of the pnpm the project declares, or undefined when it declares none we can read. */
function declaredPnpmMajor(pkg: PackageManagerFields | undefined): number | undefined {
  // The order and the shapes accepted mirror how the pinned pnpm/setup picks its version.
  const engine = pkg?.devEngines?.packageManager as { name?: unknown; version?: unknown } | undefined;
  let version: string | undefined;
  if (
    typeof engine === 'object' &&
    engine !== null &&
    !Array.isArray(engine) &&
    engine.name === 'pnpm' &&
    typeof engine.version === 'string' &&
    engine.version !== ''
  ) {
    version = engine.version;
  } else if (typeof pkg?.packageManager === 'string' && pkg.packageManager.startsWith('pnpm@')) {
    version = pkg.packageManager.slice('pnpm@'.length);
  }
  const digits = version?.match(/\d+/)?.[0];
  return digits === undefined ? undefined : Number(digits);
}

/** Which install step a scaffolded workflow can carry without it failing on its first run. */
export function planInstallStep(io: { cwd: string; readFile(path: string): string | undefined }): InstallStepPlan {
  const pm = detectPackageManagerFromLockfile(io);
  switch (pm) {
    case 'npm':
      return { kind: 'npm' };
    case 'pnpm': {
      const major = declaredPnpmMajor(readPkg((p) => io.readFile(p), io.cwd) as PackageManagerFields | undefined);
      if (major === undefined) {
        return {
          kind: 'manual',
          command: PNPM_COMMAND,
          reason:
            'the pinned pnpm setup action needs the pnpm version from "packageManager" or "devEngines.packageManager" in package.json'
        };
      }
      if (major >= 11) return { kind: 'pnpm' };
      return {
        kind: 'manual',
        command: PNPM_COMMAND,
        reason: `the pinned pnpm setup action installs pnpm 11 and newer, and this project declares pnpm ${major}`
      };
    }
    case 'yarn': {
      // Yarn 1 has no --immutable, and Yarn 2+ has no --ignore-scripts on install (--mode=skip-build skips builds).
      const classic = io.readFile(join(io.cwd, 'yarn.lock'))?.includes('# yarn lockfile v1');
      return {
        kind: 'manual',
        command: classic
          ? 'yarn install --frozen-lockfile --ignore-scripts'
          : 'yarn install --immutable --mode=skip-build',
        reason: 'this CLI does not pin a setup step for Yarn'
      };
    }
    case 'bun':
      return {
        kind: 'manual',
        command: 'bun install --frozen-lockfile --ignore-scripts',
        reason: 'this CLI does not pin a setup step for Bun'
      };
    case undefined:
      return {
        kind: 'manual',
        command: 'npm ci --ignore-scripts',
        reason:
          'no lockfile was found, so the package manager is unknown (commit your lockfile and re-run with --force to generate the step)'
      };
  }
}
