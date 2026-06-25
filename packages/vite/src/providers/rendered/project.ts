import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROBOTS_SOURCE_PATHS, SITEMAP_SOURCE_PATHS, type Detection, type Project } from '@svelte-vitals/core';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function existsAny(cwd: string, paths: readonly string[]): Promise<boolean> {
  const found = await Promise.all(paths.map((p) => exists(join(cwd, p))));
  return found.some(Boolean);
}

async function robotsRefsSitemap(cwd: string): Promise<boolean | undefined> {
  try {
    return /^\s*sitemap:/im.test(await readFile(join(cwd, 'static/robots.txt'), 'utf8'));
  } catch {
    return undefined; // endpoint / absent / unreadable — don't guess
  }
}

/** Project facts for plugin mode: robots/sitemap from source, htmlLang from rendered HTML. */
export async function collectRenderedProject(cwd: string, htmlLang: Detection): Promise<Project> {
  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    existsAny(cwd, ROBOTS_SOURCE_PATHS),
    existsAny(cwd, SITEMAP_SOURCE_PATHS)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(cwd);
  return { hasRobotsTxt, hasSitemap, htmlLang, ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}) };
}
