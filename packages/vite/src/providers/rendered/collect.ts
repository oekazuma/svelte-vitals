import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import type { ResolvedHead, Value } from '@svelte-vitals/core';
import { parseHtmlHead } from './parse-html.js';

/** Map a prerendered HTML path (relative to pages/, POSIX) to its route. */
export function deriveRouteFromHtmlPath(relPath: string): string {
  let p = relPath.replace(/\\/g, '/').replace(/\.html$/, '');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -'/index'.length);
  return '/' + p;
}

export interface CollectedHeads {
  heads: ResolvedHead[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
}

/** Read every prerendered HTML page under `prerenderPagesDir` into ResolvedHead[]. */
export async function collectRenderedHeads(prerenderPagesDir: string): Promise<CollectedHeads> {
  const files = (await glob('**/*.html', { cwd: prerenderPagesDir })).sort();
  const heads: ResolvedHead[] = [];
  let htmlLang: CollectedHeads['htmlLang'] = { presence: 'none', value: 'absent' };

  for (const rel of files) {
    const html = await readFile(join(prerenderPagesDir, rel), 'utf8');
    const parsed = parseHtmlHead(html);
    if (htmlLang.presence === 'none' && parsed.htmlLang.presence === 'own') htmlLang = parsed.htmlLang;
    heads.push({
      route: deriveRouteFromHtmlPath(rel),
      source: 'rendered',
      tags: parsed.tags,
      file: rel
    });
  }

  return { heads, htmlLang };
}
