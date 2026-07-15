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

describe('detectPackageManager', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/pnpm-lock.yaml': '' }))).toBe('pnpm');
  });
  it('detects yarn from yarn.lock', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/yarn.lock': '' }))).toBe('yarn');
  });
  it('detects bun from bun.lockb', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/bun.lockb': '' }))).toBe('bun');
  });
  it('detects bun from bun.lock (the newer text-based format)', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/bun.lock': '' }))).toBe('bun');
  });
  it('detects npm from a real package-lock.json', () => {
    expect(detectPackageManager(fakeReadCwd({ '/proj/package-lock.json': '{}' }))).toBe('npm');
  });
  it('falls back to npm when no lockfile is found', () => {
    expect(detectPackageManager(fakeReadCwd({}))).toBe('npm');
  });
});

describe('detectPackageManagerFromLockfile', () => {
  it('returns npm for a real package-lock.json — distinct from the no-lockfile case', () => {
    expect(detectPackageManagerFromLockfile(fakeReadCwd({ '/proj/package-lock.json': '{}' }))).toBe('npm');
  });
  it('returns undefined when no lockfile is found, so callers can apply their own fallback', () => {
    expect(detectPackageManagerFromLockfile(fakeReadCwd({}))).toBeUndefined();
  });
});

describe('hasVitePackage', () => {
  it('true when @svelte-vitals/vite is a devDependency', () => {
    const io = fakeReadCwd({
      '/proj/package.json': JSON.stringify({ devDependencies: { '@svelte-vitals/vite': '^1.0.0' } })
    });
    expect(hasVitePackage(io)).toBe(true);
  });
  it('true when @svelte-vitals/vite is a dependency', () => {
    const io = fakeReadCwd({
      '/proj/package.json': JSON.stringify({ dependencies: { '@svelte-vitals/vite': '^1.0.0' } })
    });
    expect(hasVitePackage(io)).toBe(true);
  });
  it('false when package.json exists but lacks the package', () => {
    const io = fakeReadCwd({ '/proj/package.json': JSON.stringify({ devDependencies: {} }) });
    expect(hasVitePackage(io)).toBe(false);
  });
  it('false when package.json does not exist', () => {
    expect(hasVitePackage(fakeReadCwd({}))).toBe(false);
  });
  it('false (not thrown) when package.json is unparseable', () => {
    const io = fakeReadCwd({ '/proj/package.json': '{not json' });
    expect(() => hasVitePackage(io)).not.toThrow();
    expect(hasVitePackage(io)).toBe(false);
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
