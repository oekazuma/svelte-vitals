import { describe, it, expect } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { globFiles } from '../src/glob.js';

async function withTree(run: (cwd: string) => Promise<void>): Promise<void> {
  const cwd = await mkdtemp(join(tmpdir(), 'sv-glob-'));
  try {
    await run(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

describe('globFiles', () => {
  it('returns files only — a directory matching the pattern is excluded', async () => {
    await withTree(async (cwd) => {
      await mkdir(join(cwd, 'src', 'Card.svelte'), { recursive: true });
      await writeFile(join(cwd, 'src', 'App.svelte'), '');
      expect(await globFiles('src/**/*.svelte', cwd)).toEqual(['src/App.svelte']);
    });
  });

  it('excludes dot directories and dot files', async () => {
    await withTree(async (cwd) => {
      await mkdir(join(cwd, '.hidden'), { recursive: true });
      await mkdir(join(cwd, 'src'), { recursive: true });
      await writeFile(join(cwd, '.hidden', 'a.svelte'), '');
      await writeFile(join(cwd, 'src', '.b.svelte'), '');
      await writeFile(join(cwd, 'src', 'c.svelte'), '');
      expect(await globFiles('**/*.svelte', cwd)).toEqual(['src/c.svelte']);
    });
  });

  it('follows a symlink that points at a file', async () => {
    await withTree(async (cwd) => {
      await mkdir(join(cwd, 'real'), { recursive: true });
      await mkdir(join(cwd, 'src'), { recursive: true });
      await writeFile(join(cwd, 'real', 'target.svelte'), '');
      await symlink(join(cwd, 'real', 'target.svelte'), join(cwd, 'src', 'link.svelte'));
      expect(await globFiles('src/**/*.svelte', cwd)).toEqual(['src/link.svelte']);
    });
  });

  it('drops a symlink whose target is missing or a directory', async () => {
    await withTree(async (cwd) => {
      await mkdir(join(cwd, 'src'), { recursive: true });
      await mkdir(join(cwd, 'dir.svelte'), { recursive: true });
      await symlink(join(cwd, 'nowhere'), join(cwd, 'src', 'broken.svelte'));
      await symlink(join(cwd, 'dir.svelte'), join(cwd, 'src', 'todir.svelte'));
      expect(await globFiles('src/**/*.svelte', cwd)).toEqual([]);
    });
  });

  it('prunes a whole subtree when exclude returns true for its directory', async () => {
    await withTree(async (cwd) => {
      await mkdir(join(cwd, 'skip', 'deep'), { recursive: true });
      await mkdir(join(cwd, 'keep'), { recursive: true });
      await writeFile(join(cwd, 'skip', 'deep', 'a.svelte'), '');
      await writeFile(join(cwd, 'keep', 'b.svelte'), '');
      const found = await globFiles('**/*.svelte', cwd, (e) => e.isDirectory() && e.name === 'skip');
      expect(found).toEqual(['keep/b.svelte']);
    });
  });
});
