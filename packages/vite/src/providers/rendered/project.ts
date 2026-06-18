import { access } from 'node:fs/promises';
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

/** Project facts for plugin mode: robots/sitemap from source, htmlLang from rendered HTML. */
export async function collectRenderedProject(cwd: string, htmlLang: Detection): Promise<Project> {
  const [hasRobotsTxt, hasSitemap] = await Promise.all([
    existsAny(cwd, ROBOTS_SOURCE_PATHS),
    existsAny(cwd, SITEMAP_SOURCE_PATHS)
  ]);
  return { hasRobotsTxt, hasSitemap, htmlLang };
}
