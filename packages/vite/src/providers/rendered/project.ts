import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { Detection, Project } from '@svelte-vitals/core';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function existsAny(cwd: string, paths: string[]): Promise<boolean> {
  for (const p of paths) if (await exists(join(cwd, p))) return true;
  return false;
}

/** Project facts for plugin mode: robots/sitemap from source, htmlLang from rendered HTML. */
export async function collectRenderedProject(cwd: string, htmlLang: Detection): Promise<Project> {
  const hasRobotsTxt = await existsAny(cwd, [
    'static/robots.txt',
    'src/routes/robots.txt/+server.ts',
    'src/routes/robots.txt/+server.js'
  ]);
  const hasSitemap = await existsAny(cwd, [
    'static/sitemap.xml',
    'src/routes/sitemap.xml/+server.ts',
    'src/routes/sitemap.xml/+server.js'
  ]);
  return { hasRobotsTxt, hasSitemap, htmlLang };
}
