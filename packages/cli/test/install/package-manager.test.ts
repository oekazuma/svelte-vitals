import { describe, it, expect } from 'vitest';
import {
  detectPackageManager,
  detectPackageManagerFromLockfile,
  hasVitePackage,
  installCommand
} from '../../src/install/package-manager.js';

function fakeReadCwd(files: Record<string, string>) {
  return {
    cwd: '/proj',
    readFile: (p: string) => files[p]
  };
}

describe('detectPackageManagerFromLockfile', () => {
  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm']
  ])('maps %s to %s', (file, pm) => {
    expect(detectPackageManagerFromLockfile(fakeReadCwd({ [`/proj/${file}`]: '' }))).toBe(pm);
  });
  it('returns undefined when no lockfile is found, so callers can apply their own fallback', () => {
    expect(detectPackageManagerFromLockfile(fakeReadCwd({}))).toBeUndefined();
  });
});

describe('detectPackageManager', () => {
  it('falls back to npm when no lockfile is found', () => {
    expect(detectPackageManager(fakeReadCwd({}))).toBe('npm');
  });
});

describe('hasVitePackage', () => {
  it('true when @svelte-vitals/vite is a devDependency', () => {
    const io = fakeReadCwd({
      '/proj/package.json': JSON.stringify({ devDependencies: { '@svelte-vitals/vite': '^1.0.0' } })
    });
    expect(hasVitePackage(io)).toBe(true);
  });
});

describe('installCommand', () => {
  it('npm uses "install", not "add"', () => {
    expect(installCommand('npm')).toEqual({ command: 'npm', args: ['install', '-D', '@svelte-vitals/vite'] });
  });
  it('pnpm/yarn/bun use "add"', () => {
    expect(installCommand('pnpm')).toEqual({ command: 'pnpm', args: ['add', '-D', '@svelte-vitals/vite'] });
    expect(installCommand('yarn')).toEqual({ command: 'yarn', args: ['add', '-D', '@svelte-vitals/vite'] });
    expect(installCommand('bun')).toEqual({ command: 'bun', args: ['add', '-D', '@svelte-vitals/vite'] });
  });
});
