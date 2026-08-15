import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { glob } from 'tinyglobby';
import type {
  A11yOccurrenceInfo,
  ResolvedA11y,
  ResolvedHead,
  ResolvedHeadings,
  ResolvedImages,
  Value
} from '@svelte-vitals/core';
import { parseHtmlHead } from './parse-html.js';

/** Group raw occurrence keys (one entry per hit, in document order) by key, `file` attached, `line: 0` (rendered mode does not track source lines). */
export function toOccurrenceMap(keys: string[], file: string): Record<string, A11yOccurrenceInfo[]> {
  // Null prototype: keys are author-controlled (`id="__proto__"` is legal page content) and a
  // plain {} would resolve such keys on Object.prototype, crashing the `??=`/push below.
  const out: Record<string, A11yOccurrenceInfo[]> = Object.create(null);
  for (const key of keys) (out[key] ??= []).push({ file, line: 0 });
  return out;
}

/** Map a prerendered HTML path (relative to pages/, POSIX) to its route. */
export function deriveRouteFromHtmlPath(relPath: string): string {
  let p = relPath.replace(/\\/g, '/').replace(/\.html$/, '');
  if (p === 'index') return '/';
  if (p.endsWith('/index')) p = p.slice(0, -'/index'.length);
  return '/' + p;
}

export interface CollectedHeads {
  heads: ResolvedHead[];
  headings: ResolvedHeadings[];
  images: ResolvedImages[];
  a11y: ResolvedA11y[];
  htmlLang: { presence: 'own' | 'none'; value: Value };
}

/** Read every prerendered HTML page under `prerenderPagesDir` into ResolvedHead[]. */
export async function collectRenderedHeads(prerenderPagesDir: string): Promise<CollectedHeads> {
  const files = (await glob('**/*.html', { cwd: prerenderPagesDir })).sort();
  // Read + parse in parallel; Promise.all preserves the sorted order so the
  // "first own <html lang>" pick below stays deterministic.
  const parsedFiles = await Promise.all(
    files.map(async (rel) => ({ rel, parsed: parseHtmlHead(await readFile(join(prerenderPagesDir, rel), 'utf8')) }))
  );

  const heads: ResolvedHead[] = [];
  const headings: ResolvedHeadings[] = [];
  const images: ResolvedImages[] = [];
  const a11y: ResolvedA11y[] = [];
  let htmlLang: CollectedHeads['htmlLang'] = { presence: 'none', value: 'absent' };

  for (const { rel, parsed } of parsedFiles) {
    if (htmlLang.presence === 'none' && parsed.htmlLang.presence === 'own') htmlLang = parsed.htmlLang;
    const route = deriveRouteFromHtmlPath(rel);
    heads.push({
      route,
      source: 'rendered',
      tags: parsed.tags,
      file: rel
    });
    headings.push({
      route,
      // Rendered mode does not track source lines (line 0 = unknown); file is the HTML path.
      headings: parsed.headings.map((level) => ({ level, line: 0, file: rel }))
    });
    images.push({ route, images: parsed.images.map((img) => ({ ...img, file: rel })) });
    a11y.push({
      route,
      landmarks: toOccurrenceMap(parsed.landmarks, rel),
      nestedLandmarks: parsed.nestedLandmarks.map((n) => ({ ...n, file: rel, line: 0 })),
      ids: toOccurrenceMap(parsed.ids, rel),
      idRefs: parsed.idRefs.map((r) => ({ ...r, file: rel, line: 0 })),
      idCandidates: [...new Set(parsed.ids)],
      // The prerendered document IS the closed world: every id/landmark/reference it can ever
      // have is already in it, unlike source mode which may hit an unresolved component.
      fullyResolved: true
    });
  }

  return { heads, headings, images, a11y, htmlLang };
}
