import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Detection } from '@svelte-vitals/core';
import {
  ROBOTS_SOURCE_PATHS,
  SITEMAP_SOURCE_PATHS,
  SVELTE_CONFIG_FILES,
  VITE_CONFIG_FILES,
  resolveKitAliases,
  resolveKitPathsBase,
  type Project
} from '@svelte-vitals/core/internal';

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

/** First existing config candidate with its source — same "only the first is loaded" rule as the CLI provider. */
async function readFirstConfig(
  cwd: string,
  files: readonly string[]
): Promise<{ file: string; source: string } | undefined> {
  for (const file of files) {
    const path = join(cwd, file);
    if (!(await exists(path))) continue;
    try {
      return { file, source: await readFile(path, 'utf8') };
    } catch {
      return undefined; // unreadable config — don't guess
    }
  }
  return undefined;
}

/** Project facts for plugin mode: robots/sitemap from source, htmlLang from rendered HTML. */
export async function collectRenderedProject(cwd: string, htmlLang: Detection): Promise<Project> {
  const [hasRobotsTxt, hasSitemap, viteConfig, svelteConfig] = await Promise.all([
    existsAny(cwd, ROBOTS_SOURCE_PATHS),
    existsAny(cwd, SITEMAP_SOURCE_PATHS),
    readFirstConfig(cwd, VITE_CONFIG_FILES),
    readFirstConfig(cwd, SVELTE_CONFIG_FILES)
  ]);
  const robotsReferencesSitemap = await robotsRefsSitemap(cwd);
  const kitPathsBase = resolveKitPathsBase(viteConfig, svelteConfig);
  const kitAliases = resolveKitAliases(viteConfig, svelteConfig);
  return {
    hasRobotsTxt,
    hasSitemap,
    htmlLang,
    ...(robotsReferencesSitemap !== undefined ? { robotsReferencesSitemap } : {}),
    ...(kitPathsBase ? { kitPathsBase } : {}),
    ...(kitAliases ? { kitAliases } : {})
  };
}
