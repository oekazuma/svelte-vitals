import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { isRelevant } from '../src/plugin.js';

const root = '/proj';

describe('isRelevant (dev-dashboard watcher filter)', () => {
  it('is relevant for files under src/', () => {
    expect(isRelevant(join(root, 'src/routes/+page.svelte'), root)).toBe(true);
  });

  it('is relevant for files under static/', () => {
    expect(isRelevant(join(root, 'static/robots.txt'), root)).toBe(true);
  });

  it('is relevant for svelte.config.js / .ts at the project root', () => {
    expect(isRelevant(join(root, 'svelte.config.js'), root)).toBe(true);
    expect(isRelevant(join(root, 'svelte.config.ts'), root)).toBe(true);
  });

  it('is relevant for svelte-vitals.config.{mjs,js,ts} at the project root', () => {
    expect(isRelevant(join(root, 'svelte-vitals.config.mjs'), root)).toBe(true);
    expect(isRelevant(join(root, 'svelte-vitals.config.js'), root)).toBe(true);
    expect(isRelevant(join(root, 'svelte-vitals.config.ts'), root)).toBe(true);
  });

  it('is relevant for vite.config.* at the project root (performance/minify-disabled depends on it)', () => {
    expect(isRelevant(join(root, 'vite.config.js'), root)).toBe(true);
    expect(isRelevant(join(root, 'vite.config.mjs'), root)).toBe(true);
    expect(isRelevant(join(root, 'vite.config.ts'), root)).toBe(true);
    expect(isRelevant(join(root, 'vite.config.cjs'), root)).toBe(true);
    expect(isRelevant(join(root, 'vite.config.mts'), root)).toBe(true);
    expect(isRelevant(join(root, 'vite.config.cts'), root)).toBe(true);
  });

  it('is irrelevant for files outside src/ and static/', () => {
    expect(isRelevant(join(root, 'README.md'), root)).toBe(false);
    expect(isRelevant(join(root, 'package.json'), root)).toBe(false);
  });

  it('excludes node_modules even under a matching prefix', () => {
    expect(isRelevant(join(root, 'node_modules/some-pkg/src/index.js'), root)).toBe(false);
  });

  it('excludes .svelte-kit, build, and dist output', () => {
    expect(isRelevant(join(root, '.svelte-kit/generated/root.svelte'), root)).toBe(false);
    expect(isRelevant(join(root, 'build/index.js'), root)).toBe(false);
    expect(isRelevant(join(root, 'dist/index.js'), root)).toBe(false);
  });

  it('is irrelevant for a path outside the project root', () => {
    expect(isRelevant('/elsewhere/src/routes/+page.svelte', root)).toBe(false);
  });
});
