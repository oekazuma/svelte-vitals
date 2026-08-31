import { glob, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

/**
 * `node:fs` glob constrained to the contract callers rely on: files only (fs.glob also matches
 * directories), cwd-relative POSIX-separated paths on every platform (fs.glob returns platform
 * separators), dotfiles excluded (fs.glob's default). A symlink's Dirent never reports isFile(),
 * so symlinks are stat'd and kept when they point at a file; symlinked *directories* are not
 * traversed — fs.glob never descends into them. Duplicated in the CLI package — core purity
 * (no `node:` imports in core) rules out the shared home.
 */
export async function globFiles(pattern: string, cwd: string): Promise<string[]> {
  const out: string[] = [];
  for await (const entry of glob(pattern, { cwd, withFileTypes: true })) {
    const path = join(entry.parentPath, entry.name);
    if (!entry.isFile()) {
      if (!entry.isSymbolicLink()) continue;
      const target = await stat(path).catch(() => null);
      if (!target?.isFile()) continue;
    }
    const rel = relative(cwd, path);
    out.push(sep === '/' ? rel : rel.split(sep).join('/'));
  }
  return out;
}
